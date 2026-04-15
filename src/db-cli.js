#!/usr/bin/env node
import mysql from "mysql2/promise";
import dm from "dmdb";
import fs from "fs";
import cac from "cac";

// ============================================
// DB-CLI - 多数据库 CLI 工具
// ============================================
// 用法:
//   node db-cli.js -h                           显示帮助
//   node db-cli.js -c 'dm://user:pass@host:port' import -f xx   导入 SQL
//   node db-cli.js -c 'dm://user:pass@host:port' export -s xx   导出数据
//   node db-cli.js -c 'dm://user:pass@host:port' exec -q 'xx'   执行 SQL
//   node db-cli.js -c 'mysql://user:pass@host:port' ...         MySQL 支持
// ============================================

// 解析连接字符串
function parseConnectionString(connStr) {
  // mysql://user:pass@host:port - 不支持 database
  const mysqlMatch = connStr.match(
    /^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/,
  );

  // dm://user:pass@host:port
  const dmMatch = connStr.match(/^dm:\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/);

  if (mysqlMatch) {
    return {
      type: "mysql",
      username: mysqlMatch[1],
      password: mysqlMatch[2],
      host: mysqlMatch[3],
      port: parseInt(mysqlMatch[4], 10),
      database: null, // MySQL 连接字符串不再支持数据库名
    };
  }

  if (dmMatch) {
    return {
      type: "dm",
      username: dmMatch[1],
      password: dmMatch[2],
      host: dmMatch[3],
      port: parseInt(dmMatch[4], 10),
    };
  }

  throw new Error(`连接字符串格式错误
支持格式:
  - MySQL: mysql://user:pass@host:port
  - 达梦数据库：dm://user:pass@host:port
注意：连接字符串不再支持数据库名，所有 schema 请通过 SQL 语句处理`);
}

// 创建数据库连接的工厂函数
async function createConnection(connInfo) {
  if (connInfo.type === "mysql") {
    const conn = await mysql.createConnection({
      host: connInfo.host,
      port: connInfo.port,
      user: connInfo.username,
      password: connInfo.password,
    });

    // 包装 MySQL 连接以匹配统一接口
    return {
      type: "mysql",
      raw: conn,
      execute: async (sql) => {
        const [rows] = await conn.execute(sql);
        // 转换为统一格式
        return {
          rows: Array.isArray(rows) ? rows : [],
          metaData:
            rows.length > 0
              ? Object.keys(rows[0]).map((k) => ({ name: k }))
              : [],
          updateCount:
            rows.affectedRows !== undefined ? rows.affectedRows : rows.length,
        };
      },
      commit: async () => {
        await conn.commit();
      },
      rollback: async () => {
        await conn.rollback();
      },
      close: async () => {
        await conn.end();
      },
    };
  } else if (connInfo.type === "dm") {
    const conn = await dm.getConnection(
      `dm://${connInfo.username}:${connInfo.password}@${connInfo.host}:${connInfo.port}`,
    );
    return {
      type: "dm",
      raw: conn,
      execute: (sql) => conn.execute(sql),
      commit: () => conn.commit(),
      rollback: () => conn.rollback(),
      close: () => conn.close(),
    };
  }

  throw new Error("不支持的数据库类型：" + connInfo.type);
}

// ============================================
// 导入功能实现
// ============================================

function updateProgress(current, total) {
  const percentage = ((current / total) * 100).toFixed(1);
  const barWidth = 30;
  const filled = Math.round((barWidth * current) / total);
  const empty = barWidth - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  process.stdout.write(`\r进度：[${bar}] ${current}/${total} (${percentage}%)`);
  if (current === total) {
    process.stdout.write("\n");
  }
}

// SQL 解析器 - 导出供测试使用
// 支持 MySQL DELIMITER 语法和达梦数据库 / 分隔符
// 返回格式：[{ sql: string, startLine: number, endLine: number }, ...]
export function readSqlFile(filePath, dbType = "dm") {
  const content = fs.readFileSync(filePath, "utf-8");

  const statements = [];
  const lines = content.split("\n");
  let currentStatement = "";
  let currentStatementStartLine = 1; // 记录当前语句的起始行号

  // MySQL DELIMITER 处理状态
  // insideDelimiterBlock = true 表示当前在使用自定义分隔符（如 $$）
  let insideDelimiterBlock = false;
  let currentDelimiter = ";"; // 当前有效的语句分隔符

  // 达梦数据库存储过程状态
  let inDamengProcedure = false;
  // 单引号字符串状态（用于跟踪是否在字符串内）
  let inSingleQuote = false;

  // 计算一行中未配对的单引号数量（SQL 中使用 '' 转义单引号）
  function countUnescapedQuotes(str) {
    let count = 0;
    let i = 0;
    while (i < str.length) {
      if (str[i] === "'") {
        // 检查是否是转义的单引号 ''
        if (i + 1 < str.length && str[i + 1] === "'") {
          i += 2; // 跳过转义的单引号
        } else {
          count++;
          i++;
        }
      } else {
        i++;
      }
    }
    return count;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const originalLine = line;
    const lineNumber = i + 1; // 行号从 1 开始
    const trimmedLine = line.trim();

    // 跳过空行
    if (!trimmedLine) continue;

    // 注释处理
    // -- 注释：两种数据库都支持
    if (trimmedLine.startsWith("--")) continue;
    // # 注释：仅 MySQL 支持
    if (dbType === "mysql" && trimmedLine.startsWith("#")) continue;

    // 如果是新语句的开始，记录起始行号
    if (currentStatement === "") {
      currentStatementStartLine = lineNumber;
    }

    // MySQL DELIMITER 处理
    if (dbType === "mysql") {
      // 检查是否是 DELIMITER 语句
      const delimiterMatch = trimmedLine.match(/^DELIMITER\s+(\S+)\s*$/i);
      if (delimiterMatch) {
        const newDelimiter = delimiterMatch[1];
        // 切换分隔符模式
        if (newDelimiter === ";") {
          // 恢复标准分隔符，结束当前语句
          insideDelimiterBlock = false;
          currentDelimiter = ";";
          if (currentStatement.trim()) {
            statements.push({
              sql: currentStatement.trim(),
              startLine: currentStatementStartLine,
              endLine: lineNumber,
            });
            currentStatement = "";
          }
        } else {
          // 使用自定义分隔符（如 $$）
          insideDelimiterBlock = true;
          currentDelimiter = newDelimiter;
        }
        continue;
      }

      // 在 DELIMITER 块内，检查是否遇到自定义分隔符（如 $$ 在行尾）
      if (insideDelimiterBlock) {
        // 更新单引号状态
        const quoteCount = countUnescapedQuotes(originalLine);
        inSingleQuote = (inSingleQuote + quoteCount) % 2 === 1;

        // 检查行尾是否是自定义分隔符（如 "END $$"）
        if (trimmedLine.endsWith(currentDelimiter)) {
          // 移除行尾的分隔符
          const lineWithoutDelimiter = trimmedLine.substring(0, trimmedLine.length - currentDelimiter.length).trim();
          if (lineWithoutDelimiter) {
            currentStatement += lineWithoutDelimiter + "\n";
          }
          if (currentStatement.trim()) {
            statements.push({
              sql: currentStatement.trim(),
              startLine: currentStatementStartLine,
              endLine: lineNumber,
            });
          }
          currentStatement = "";
          insideDelimiterBlock = false;
          currentDelimiter = ";";
        } else {
          currentStatement += originalLine + "\n";
        }
        continue;
      }
    }

    // 达梦数据库存储过程处理
    if (dbType === "dm") {
      // 检查是否是存储过程开始
      if (trimmedLine.includes("CREATE OR REPLACE PROCEDURE") || trimmedLine.includes("CREATE PROCEDURE")) {
        inDamengProcedure = true;
      }

      // 检查是否是 / 分隔符（达梦存储过程结束符）
      if (trimmedLine === "/") {
        if (inDamengProcedure) {
          // 结束存储过程
          if (currentStatement.trim()) {
            statements.push({
              sql: currentStatement.trim(),
              startLine: currentStatementStartLine,
              endLine: lineNumber,
            });
          }
          currentStatement = "";
          inDamengProcedure = false;
        } else {
          // 普通语句的 / 分隔符
          if (currentStatement.trim()) {
            statements.push({
              sql: currentStatement.trim(),
              startLine: currentStatementStartLine,
              endLine: lineNumber,
            });
            currentStatement = "";
          }
        }
        continue;
      }

      // 在存储过程内，累积所有行（包括分号）
      if (inDamengProcedure) {
        currentStatement += originalLine + "\n";
        // 更新单引号状态
        const quoteCount = countUnescapedQuotes(originalLine);
        inSingleQuote = (inSingleQuote + quoteCount) % 2 === 1;
        continue;
      }

      // 普通达梦语句：分号结束（需要检查分号是否在字符串外）
      // 先更新单引号状态，然后检查行尾分号是否有效
      const quoteCount = countUnescapedQuotes(originalLine);
      const wasInSingleQuote = inSingleQuote;
      inSingleQuote = (inSingleQuote + quoteCount) % 2 === 1;

      // 只有当分号不在字符串内时，才视为语句结束
      currentStatement += originalLine + "\n";
      if (trimmedLine.endsWith(";") && !inSingleQuote) {
        const trimmed = currentStatement.trim();
        if (trimmed) {
          statements.push({
            sql: trimmed,
            startLine: currentStatementStartLine,
            endLine: lineNumber,
          });
        }
        currentStatement = "";
      }
      continue;
    }

    // 标准 ; 分隔符处理（其他数据库）
    // 更新单引号状态
    const quoteCount = countUnescapedQuotes(originalLine);
    inSingleQuote = (inSingleQuote + quoteCount) % 2 === 1;

    currentStatement += originalLine + "\n";
    // 只有当分号不在字符串内时，才视为语句结束
    if (trimmedLine.endsWith(";") && !inSingleQuote) {
      const trimmed = currentStatement.trim();
      if (trimmed) {
        statements.push({
          sql: trimmed,
          startLine: currentStatementStartLine,
          endLine: lineNumber,
        });
      }
      currentStatement = "";
    }
  }

  // 处理剩余语句
  if (currentStatement.trim()) {
    statements.push({
      sql: currentStatement.trim(),
      startLine: currentStatementStartLine,
      endLine: lines.length,
    });
  }

  return statements;
}

async function executeSqlStatements(conn, statements, config) {
  const continueOnError = config.continueOnError;
  let success = 0;
  let errors = 0;
  const errorDetails = [];
  const total = statements.length;
  let lastProgressUpdate = 0;

  console.log("执行中...");
  updateProgress(0, total);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    // 支持新旧两种格式：新格式是对象 {sql, startLine, endLine}，旧格式是字符串
    const sql = typeof stmt === "object" ? stmt.sql : stmt;
    const startLine = typeof stmt === "object" ? stmt.startLine : null;
    const endLine = typeof stmt === "object" ? stmt.endLine : null;

    try {
      // MySQL: DDL 和管理命令不能用 prepared statement 执行，需要使用 raw.query
      if (conn.type === "mysql") {
        // 检查是否是 DDL 或管理命令
        // 包含：USE, SET, SHOW, CREATE, DROP, ALTER, TRUNCATE, REPLACE, RENAME, LOAD, LOCK, UNLOCK
        // GRANT, REVOKE, FLUSH, RESET, CALL, BEGIN, COMMIT, ROLLBACK 等
        const ddlPattern = /^\s*(USE|SET|SHOW|CREATE|DROP|ALTER|TRUNCATE|REPLACE|RENAME|LOAD|LOCK|UNLOCK|GRANT|REVOKE|FLUSH|RESET|CALL|BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\s*/i;
        if (ddlPattern.test(sql)) {
          await conn.raw.query(sql);
          success++;
          const progressStep = Math.max(1, Math.floor(total / 100));
          if (i + 1 - lastProgressUpdate >= progressStep) {
            updateProgress(i + 1, total);
            lastProgressUpdate = i + 1;
          }
          continue;
        }
      }

      await conn.execute(sql);
      success++;
      const progressStep = Math.max(1, Math.floor(total / 100));
      if (i + 1 - lastProgressUpdate >= progressStep) {
        updateProgress(i + 1, total);
        lastProgressUpdate = i + 1;
      }
    } catch (err) {
      errors++;

      // 构建详细的错误信息
      const lineNumber = startLine || (i + 1);

      errorDetails.push({
        index: i + 1,
        message: err.message,
        lineNumber: lineNumber,
        sql: sql, // 保存完整 SQL
        errorCode: err.code || err.errno || null,
      });
      if (!continueOnError) {
        console.log();
        console.log(`❌ 第 ${lineNumber} 行 SQL 执行失败:`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        // 显示错误代码（如果有）
        if (err.code || err.errno) {
          console.log(`错误代码：${err.code || err.errno}`);
        }

        // 显示错误原因
        console.log(`错误原因：${err.message}`);

        // 显示完整 SQL（短 SQL 显示全部，长 SQL 显示前 500 字符）
        if (sql.length <= 200) {
          console.log(`\nSQL 语句:\n${sql}`);
        } else {
          console.log(`\nSQL 语句（前 500 字符）:\n${sql.substring(0, 500)}...`);
        }

        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        await conn.rollback();
        console.log(`\n💾 事务已回滚`);
        throw err;
      }
    }
  }

  if (lastProgressUpdate < total) {
    updateProgress(total, total);
  }

  console.log(`\n完成：${success} 成功，${errors} 失败`);

  // --continue-on-error 模式下显示失败统计和前 10 条失败 SQL
  if (errorDetails.length > 0 && continueOnError) {
    const displayCount = Math.min(10, errorDetails.length);
    console.log(`\n⚠️  共有 ${errorDetails.length} 条语句执行失败，以下是前 ${displayCount} 条:`);
    for (let i = 0; i < displayCount; i++) {
      const err = errorDetails[i];
      console.log(`\n❌ 第 ${err.lineNumber} 行:`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // 显示错误代码（如果有）
      if (err.errorCode) {
        console.log(`错误代码：${err.errorCode}`);
      }

      // 显示错误原因
      console.log(`错误原因：${err.message}`);

      // 显示 SQL 语句（短 SQL 显示全部，长 SQL 显示前 300 字符）
      if (err.sql.length <= 150) {
        console.log(`\nSQL 语句:\n${err.sql}`);
      } else {
        console.log(`\nSQL 语句（前 300 字符）:\n${err.sql.substring(0, 300)}...`);
      }

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
  }

  return { success, errors };
}

async function runImport(conn, options) {
  const config = {
    file: options.file,
    continueOnError: options.continueOnError || false,
    dbType: conn.type, // 从连接对象获取数据库类型
  };

  if (!config.file) {
    console.error("错误：缺少必填参数 -f/--file");
    process.exit(1);
  }

  if (!fs.existsSync(config.file)) {
    console.error(`错误：文件不存在：${config.file}`);
    process.exit(1);
  }

  console.log("导入 SQL 文件");
  console.log("============");
  console.log(`文件：${config.file}`);
  console.log("");

  const statements = readSqlFile(config.file, config.dbType);
  console.log(`读取到 ${statements.length} 条 SQL 语句`);
  console.log("");

  await executeSqlStatements(conn, statements, config);
  console.log("导入完成");
}

// ============================================
// 导出功能实现
// ============================================

async function getTableList(conn, schema, filterTables = []) {
  let sql = "SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = ?";
  const params = [schema.toUpperCase()];

  if (filterTables.length > 0) {
    sql += " AND TABLE_NAME IN (" + filterTables.map(() => "?").join(",") + ")";
    params.push(...filterTables.map((t) => t.toUpperCase()));
  }

  const result = await conn.execute(sql, params);
  return result.rows.map((row) => row[0]);
}

async function getTableListMySQL(conn, database, filterTables = []) {
  // 先选择数据库 (使用 query 而非 execute，因为 USE 命令不支持 prepared statement)
  await conn.raw.query(`USE \`${database}\``);

  const result = await conn.raw.query("SHOW TABLES");
  let tables = result[0].map((row) => {
    // MySQL SHOW TABLES returns single column data
    const tableName = Object.values(row)[0];
    return tableName;
  });

  if (filterTables.length > 0) {
    tables = tables.filter((t) => filterTables.includes(t));
  }

  return tables;
}

async function getTableDDL(conn, tableName, schema) {
  const result = await conn.execute(
    "SELECT DBMS_METADATA.GET_DDL(?, ?, ?) AS DDL FROM DUAL",
    ["TABLE", tableName.toUpperCase(), schema.toUpperCase()],
  );

  if (result.rows.length === 0) return "";

  const clob = result.rows[0][0];
  const ddl = await clob.getData();
  await clob.close();

  return ddl + ";";
}

async function getTableDDLMySQL(conn, tableName, database) {
  const result = await conn.raw.query(`SHOW CREATE TABLE \`${tableName}\``);
  if (result[0].length === 0) return "";

  // SHOW CREATE TABLE returns two columns: table name and CREATE statement
  const createStmt = result[0][0]['Create Table'];
  return createStmt + ";";
}

async function getTableData(conn, tableName, schema) {
  const result = await conn.execute(`SELECT * FROM "${schema}"."${tableName}"`);
  return {
    rows: result.rows,
    metaData: result.metaData,
  };
}

async function getTableDataMySQL(conn, tableName, database) {
  const result = await conn.raw.query(`SELECT * FROM \`${tableName}\``);
  return {
    rows: result[0],
    metaData:
      result[0].length > 0
        ? Object.keys(result[0][0]).map((k) => ({ name: k }))
        : [],
  };
}

function generateInserts(tableName, rows, metaData, dbType = "dm") {
  const statements = [];
  const columns = metaData.map((col) => col.name);

  // Numeric pattern for recognizing numeric strings (INT, DECIMAL, etc.)
  const numericPattern = /^-?\d+(\.\d+)?$/;

  for (const row of rows) {
    // MySQL returns objects, DM returns arrays
    const values = Array.isArray(row)
      ? row.map((val, idx) => {
          if (val === null) return "NULL";
          if (typeof val === "number") return val.toString();
          // Check if string is a numeric value (e.g., DECIMAL from MySQL)
          if (typeof val === "string" && numericPattern.test(val)) return val;
          // Handle Date objects - format as ISO string for SQL
          if (val instanceof Date) {
            // Check for invalid date
            if (isNaN(val.getTime())) return "NULL";
            return `'${val.toISOString().replace("T", " ").substring(0, 19)}'`;
          }
          const escaped = val.toString().replace(/'/g, "''");
          return `'${escaped}'`;
        })
      : columns.map((col) => {
          const val = row[col];
          if (val === null) return "NULL";
          if (typeof val === "number") return val.toString();
          // Check if string is a numeric value (e.g., DECIMAL from MySQL)
          if (typeof val === "string" && numericPattern.test(val)) return val;
          // Handle Date objects - format as ISO string for SQL
          if (val instanceof Date) {
            // Check for invalid date
            if (isNaN(val.getTime())) return "NULL";
            return `'${val.toISOString().replace("T", " ").substring(0, 19)}'`;
          }
          const escaped = val.toString().replace(/'/g, "''");
          return `'${escaped}'`;
        });

    if (dbType === "mysql") {
      statements.push(
        `INSERT INTO \`${tableName}\` (\`${columns.join("`, `")}\`) VALUES (${values.join(", ")});`,
      );
    } else {
      statements.push(
        `INSERT INTO "${tableName}" ("${columns.join('", "')}") VALUES (${values.join(", ")});`,
      );
    }
  }

  return statements;
}

async function runExport(conn, options) {
  const config = {
    schema: options.schema,
    type: options.type || "all",
    mode: "full",
    tables: options.table
      ? Array.isArray(options.table)
        ? options.table
        : [options.table]
      : [],
    tablesList: options.tablesList,
    query: options.query,
    output: options.output,
  };

  // 处理 --type 参数
  if (options.type) {
    const typeValue = options.type.toLowerCase();
    if (typeValue === "schema") {
      config.mode = "schema";
    } else if (typeValue === "data") {
      config.mode = "data";
    } else if (typeValue === "all") {
      config.mode = "full";
    } else {
      console.error("错误：--type 必须是 schema、data 或 all");
      showExportHelp();
      process.exit(1);
    }
  }

  // 处理多表选项
  if (options.tablesList) {
    config.tables = options.tablesList.split(",").map((t) => t.trim());
  }

  if (!config.schema && !config.query) {
    console.error("错误：缺少必填参数 -s/--schema 或 -q/--query");
    showExportHelp();
    process.exit(1);
  }

  console.log(`${conn.type === "mysql" ? "MySQL" : "达梦数据库"}导出工具`);
  console.log("================");
  console.log(
    `${conn.type === "mysql" ? "Database" : "Schema"}: ${config.schema || "N/A"}`,
  );
  console.log(`模式：${config.mode}`);
  console.log("");

  const output = [];

  if (config.query) {
    console.log(`执行查询...`);
    const result = await conn.execute(config.query);
    console.log(`查询到 ${result.rows.length} 行数据`);
    const inserts = generateInserts(
      "QUERY_RESULT",
      result.rows,
      result.metaData,
      conn.type,
    );
    output.push(`-- 查询结果：${result.rows.length} 行`);
    output.push(`-- 列：${result.metaData.map((col) => col.name).join(", ")}`);
    output.push("");
    output.push(...inserts);
  } else {
    console.log("获取表列表...");
    // Select correct function based on database type
    const getTableListFn =
      conn.type === "mysql" ? getTableListMySQL : getTableList;
    const getTableDDLFn =
      conn.type === "mysql" ? getTableDDLMySQL : getTableDDL;
    const getDataFn = conn.type === "mysql" ? getTableDataMySQL : getTableData;

    // Get table list (note parameter differences)
    const tables = await getTableListFn(conn, config.schema, config.tables);
    console.log(`找到 ${tables.length} 个表`);

    for (let i = 0; i < tables.length; i++) {
      const tableName = tables[i];
      console.log(`[${i + 1}/${tables.length}] 处理表：${tableName}`);

      if (config.mode === "full" || config.mode === "schema") {
        console.log("  - 导出表结构...");
        const ddl = await getTableDDLFn(conn, tableName, config.schema);
        output.push(ddl);
      }

      if (config.mode === "full" || config.mode === "data") {
        console.log("  - 导出数据...");
        const data = await getDataFn(conn, tableName, config.schema);
        const inserts = generateInserts(
          tableName,
          data.rows,
          data.metaData,
          conn.type,
        );
        output.push(...inserts);
        console.log(`    导出 ${data.rows.length} 行`);
      }
    }
  }

  const result = output.join("\n");

  if (config.output) {
    fs.writeFileSync(config.output, result, "utf-8");
    console.log(`\n导出完成！已保存到：${config.output}`);
    console.log(
      `总大小：${(Buffer.byteLength(result, "utf8") / 1024).toFixed(2)} KB`,
    );
  } else {
    console.log("");
    console.log(result);
  }
}

// ============================================
// 执行功能实现
// ============================================

async function runExec(conn, options) {
  const config = {
    sql: options.query,
    format: options.format || "table",
    continueOnError: options.continueOnError || false,
  };

  if (!config.sql) {
    console.error("错误：缺少 SQL 语句，请使用 -q/--query 指定");
    showExecHelp();
    process.exit(1);
  }

  // 验证 format 参数
  if (options.format) {
    const formatValue = options.format.toLowerCase();
    if (formatValue === "json") {
      config.format = "json";
    } else if (formatValue === "table") {
      config.format = "table";
    } else {
      console.error("错误：--format 必须是 json 或 table");
      showExecHelp();
      process.exit(1);
    }
  }

  const startTime = Date.now();

  // 分割 SQL 语句（按分号分隔）
  const statements = splitSqlStatements(config.sql);

  if (statements.length === 0) {
    if (config.format === "json") {
      console.log('[{"rows": 0, "elapsed": "0ms", "data": []}]');
    } else {
      console.table([]);
      console.log("0 rows");
      console.log("Elapsed: 0ms");
    }
    return;
  }

  const results = [];

  if (config.continueOnError) {
    // --continue-on-error 模式：每条语句自动提交，跳过错误
    let success = 0;
    let errors = 0;

    for (let i = 0; i < statements.length; i++) {
      const statementStartTime = Date.now();
      const statement = statements[i];
      try {
        // MySQL: DDL 和管理命令不能用 prepared statement 执行，需要使用 raw.query
        let result;
        if (conn.type === "mysql") {
          const ddlPattern = /^\s*(USE|SET|SHOW|CREATE|DROP|ALTER|TRUNCATE|REPLACE|RENAME|LOAD|LOCK|UNLOCK|GRANT|REVOKE|FLUSH|RESET|CALL|BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\s*/i;
          if (ddlPattern.test(statement)) {
            await conn.raw.query(statement);
            result = { updateCount: 0 };
          } else {
            result = await conn.execute(statement);
          }
        } else {
          result = await conn.execute(statement);
        }

        const elapsed = Date.now() - statementStartTime;
        if (result.rows && result.metaData) {
          results.push({
            statement: i + 1,
            rows: formatRows(result.rows, result.metaData),
            elapsed: `${elapsed}ms`,
            metaData: result.metaData,
            updateCount: result.rows.length,
          });
        } else if (result.updateCount !== undefined) {
          results.push({
            statement: i + 1,
            elapsed: `${elapsed}ms`,
            updateCount: result.updateCount,
          });
        }
        success++;
      } catch (err) {
        errors++;
        console.error(`语句 ${i + 1} 错误：${err.message}`);
      }
    }

    console.log(`${success} 成功，${errors} 失败`);
  } else {
    // 默认模式：事务执行
    try {
      for (let i = 0; i < statements.length; i++) {
        const statementStartTime = Date.now();
        const statement = statements[i];

        // MySQL: DDL 和管理命令不能用 prepared statement 执行，需要使用 raw.query
        let result;
        if (conn.type === "mysql") {
          const ddlPattern = /^\s*(USE|SET|SHOW|CREATE|DROP|ALTER|TRUNCATE|REPLACE|RENAME|LOAD|LOCK|UNLOCK|GRANT|REVOKE|FLUSH|RESET|CALL|BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\s*/i;
          if (ddlPattern.test(statement)) {
            await conn.raw.query(statement);
            result = { updateCount: 0 };
          } else {
            result = await conn.execute(statement);
          }
        } else {
          result = await conn.execute(statement);
        }

        const elapsed = Date.now() - statementStartTime;
        if (result.rows && result.metaData) {
          results.push({
            statement: i + 1,
            rows: formatRows(result.rows, result.metaData),
            elapsed: `${elapsed}ms`,
            metaData: result.metaData,
            updateCount: result.rows.length,
          });
        } else if (result.updateCount !== undefined) {
          results.push({
            statement: i + 1,
            elapsed: `${elapsed}ms`,
            updateCount: result.updateCount,
          });
        }
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  }

  const totalElapsed = Date.now() - startTime;

  // 输出结果
  if (config.format === "json") {
    // JSON 模式：新结构 [{rows, elapsed, data}, ...]
    const resultOutput = results.map((r) => ({
      rows: r.rows ? r.rows.length : 0,
      elapsed: r.elapsed || `${totalElapsed}ms`,
      data: r.rows || [],
    }));
    console.log(JSON.stringify(resultOutput, null, 2));
  } else {
    // 表格模式（默认）
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (results.length > 1) {
        console.log(`--- 语句 ${i + 1} ---`);
      }
      if (r.rows && r.rows.length > 0) {
        console.table(r.rows);
        console.log(`${r.rows.length} rows returned`);
      } else {
        // 空结果：显示空表格
        console.table([]);
        console.log("0 rows");
      }
      console.log(`Elapsed: ${r.elapsed || totalElapsed + "ms"}`);
    }
  }
}

// 分割 SQL 语句的辅助函数
function splitSqlStatements(sql) {
  // 移除单行注释
  let cleaned = sql.replace(/--.*$/gm, "");

  // 按分号分割
  const statements = cleaned
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return statements;
}

// 格式化行数据（处理长字符串截断）
function formatRows(rows, metaData) {
  return rows.map((row) => {
    const formattedRow = {};
    // 支持数组和对象两种格式
    // 达梦返回数组格式：row[0], row[1], ...
    // MySQL 返回对象格式：row.columnName
    if (Array.isArray(row)) {
      for (let i = 0; i < row.length; i++) {
        const col = metaData[i].name;
        let val = row[i];
        // 字符串截断到 50 字符
        if (typeof val === "string" && val.length > 50) {
          val = val.substring(0, 50) + "...";
        }
        formattedRow[col] = val;
      }
    } else {
      // 对象格式
      for (const colMeta of metaData) {
        const col = colMeta.name;
        let val = row[col];
        if (typeof val === "string" && val.length > 50) {
          val = val.substring(0, 50) + "...";
        }
        formattedRow[col] = val;
      }
    }
    return formattedRow;
  });
}

// ============================================
// 使用 cac 定义 CLI
// ============================================

const cli = cac("db-cli");

// 全局连接选项
cli.option(
  "-c, --connection <string>",
  "数据库连接字符串\n                                  达梦数据库：dm://user:pass@host:port\n                                  MySQL: mysql://user:pass@host:port",
);

// 获取全局选项的辅助函数
function getConnectionStr() {
  return cli.options.connection;
}

// 检查连接字符串的辅助函数
function checkConnectionStr() {
  const connStr = getConnectionStr();
  // 空字符串视为未提供连接
  if (!connStr || connStr.trim() === "") {
    console.error("错误：缺少必填参数 -c/--connection");
    console.error("用法：db -c '<连接字符串>' <command> [options]");
    console.error("");
    console.error("示例:");
    console.error("  # 达梦数据库");
    console.error(
      "  db -c 'dm://SYSDBA:SYSDBA@10.50.8.44:5236' exec -q 'SELECT 1'",
    );
    console.error("");
    console.error("  # MySQL");
    console.error(
      "  db -c 'mysql://root:password@localhost:3306' exec -q 'SELECT 1'",
    );
    process.exit(1);
  }
  return connStr;
}

// import 子命令
cli
  .command("import", "导入 SQL 文件到数据库")
  .option("-f, --file <path>", "SQL 文件路径")
  .option("-s, --schema <name>", "Schema/数据库名称")
  .option("--continue-on-error", "遇到错误继续执行")
  .alias("i")
  .action(async (options) => {
    const connStr = checkConnectionStr();
    try {
      const connInfo = parseConnectionString(connStr);
      console.log(`连接数据库：${connInfo.host}:${connInfo.port}`);
      console.log(`用户：${connInfo.username}`);
      console.log(
        `类型：${connInfo.type === "mysql" ? "MySQL" : "达梦数据库"}`,
      );
      console.log("");

      const conn = await createConnection(connInfo);
      console.log("数据库连接成功");

      // MySQL 需要先选择数据库
      if (conn.type === "mysql" && options.schema) {
        await conn.raw.query(`USE \`${options.schema}\``);
        console.log(`已选择数据库：${options.schema}`);
      }
      console.log("");

      await runImport(conn, options);

      await conn.close();
    } catch (err) {
      // 错误详情已在 executeSqlStatements 中打印
      process.exit(1);
    }
  });

// export 子命令
cli
  .command("export", "从数据库导出数据/表结构")
  .option("-s, --schema <name>", "Schema 名称")
  .option("-t, --table <name>", "导出单表")
  .option("-T, --tables-list <list>", "导出多表 (逗号分隔)")
  .option("-q, --query <sql>", "自定义查询导出")
  .option("-o, --output <file>", "输出文件路径")
  .option("--type <type>", "导出类型：schema|data|all", { default: "all" })
  .alias("e")
  .action(async (options) => {
    const connStr = checkConnectionStr();
    try {
      const connInfo = parseConnectionString(connStr);
      console.log(`连接数据库：${connInfo.host}:${connInfo.port}`);
      console.log(`用户：${connInfo.username}`);
      console.log(
        `类型：${connInfo.type === "mysql" ? "MySQL" : "达梦数据库"}`,
      );
      console.log("");

      const conn = await createConnection(connInfo);
      console.log("数据库连接成功");
      console.log("");

      await runExport(conn, options);

      await conn.close();
    } catch (err) {
      console.error("错误:", err.message);
      process.exit(1);
    }
  });

// exec 子命令
cli
  .command("exec", "执行 SQL 语句")
  .option("-q, --query <sql>", "SQL 语句")
  .option("--format <format>", "输出格式：json|table", { default: "table" })
  .option("--continue-on-error", "遇到错误继续执行")
  .alias("x")
  .action(async (options) => {
    const connStr = checkConnectionStr();
    try {
      const connInfo = parseConnectionString(connStr);
      console.log(`连接数据库：${connInfo.host}:${connInfo.port}`);
      console.log(`用户：${connInfo.username}`);
      console.log(
        `类型：${connInfo.type === "mysql" ? "MySQL" : "达梦数据库"}`,
      );
      console.log("");

      const conn = await createConnection(connInfo);
      console.log("数据库连接成功");
      console.log("");

      await runExec(conn, options);

      await conn.close();
    } catch (err) {
      console.error("错误:", err.message);
      process.exit(1);
    }
  });

// 帮助信息（cac 自动生成）
cli.help();

// Only run CLI when executed directly (not when imported as module)
const isMainModule = process.argv[1] && process.argv[1].endsWith("db-cli.js");
if (isMainModule) {
  // 当没有任何参数时，显示主帮助
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0) {
    cli.outputHelp();
    process.exit(0);
  }

  // 未知命令检测 - 在解析前检查第一个参数是否为已知命令
  const firstArg = rawArgs[0];
  if (!firstArg.startsWith("-")) {
    const knownCommands = [
      "import",
      "i",
      "export",
      "e",
      "exec",
      "x",
      "help",
      "--help",
      "-h",
    ];
    if (!knownCommands.includes(firstArg)) {
      console.error(`错误：不识别的命令 '${firstArg}'`);
      console.error("可用命令：import (i), export (e), exec (x)");
      console.error("使用 <命令> --help 查看具体命令的帮助");
      console.error("示例：db exec --help");
      process.exit(1);
    }
  }

  // 解析命令行参数 - 捕获未知选项错误
  try {
    cli.parse();
  } catch (err) {
    if (err.message && err.message.includes("Unknown option")) {
      const match = err.message.match(/Unknown option `([^`]+)`/);
      const unknownOpt = match ? match[1] : "unknown";
      console.error(`不识别的选项 '${unknownOpt}'`);
      process.exit(1);
    }
    throw err;
  }
}
