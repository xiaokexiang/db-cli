#!/usr/bin/env node
import mysql from "mysql2/promise";
import dm from "dmdb";
import fs from "fs";
import cac from "cac";
import glob from "fast-glob";

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

// MySQL DDL 和管理命令判断正则
const MYSQL_DDL_PATTERN = /^\s*(USE|SET|SHOW|CREATE|DROP|ALTER|TRUNCATE|REPLACE|RENAME|LOAD|LOCK|UNLOCK|GRANT|REVOKE|FLUSH|RESET|CALL|BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\s*/i;

/**
 * 执行单条 MySQL 语句
 * MySQL 的 DDL 和管理命令不能用 prepared statement 执行，需要使用 raw.query
 */
async function executeMySqlStatement(conn, sql) {
  if (MYSQL_DDL_PATTERN.test(sql)) {
    await conn.raw.query(sql);
    return { updateCount: 0 };
  }
  return await conn.execute(sql);
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
      // MySQL: DDL 和管理命令使用 raw.query，其他使用 execute
      if (conn.type === "mysql") {
        await executeMySqlStatement(conn, sql);
        success++;
        const progressStep = Math.max(1, Math.floor(total / 100));
        if (i + 1 - lastProgressUpdate >= progressStep) {
          updateProgress(i + 1, total);
          lastProgressUpdate = i + 1;
        }
        continue;
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
        console.log(`第 ${lineNumber} 行 SQL 执行失败:`);
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
        console.log(`\n事务已回滚`);
        throw err;
      }
    }
  }

  if (lastProgressUpdate < total) {
    updateProgress(total, total);
  }

  console.log(`\n完成：${success} 成功，${errors} 失败`);

  // --continue-on-error 模式下，单文件内错误不立即显示，留待最终汇总
  // 只返回错误详情，由上层调用者决定如何展示

  return { success, errors, errorDetails };
}

async function runImport(conn, options, positionalFiles = []) {
  // 合并 -f 选项和位置参数的文件
  const fileInputs = [];

  if (options.file) {
    // -f 选项可以是单个字符串或数组（取决于用户如何传递）
    if (Array.isArray(options.file)) {
      fileInputs.push(...options.file);
    } else {
      fileInputs.push(options.file);
    }
  }

  // 添加位置参数（shell 展开的通配符结果）
  if (positionalFiles && positionalFiles.length > 0) {
    fileInputs.push(...positionalFiles);
  }

  if (fileInputs.length === 0) {
    console.error("错误：缺少必填参数 -f/--file");
    process.exit(1);
  }

  // 配置
  const config = {
    file: fileInputs,
    continueOnError: options.continueOnError || false,
    dbType: conn.type, // 从连接对象获取数据库类型
  };

  // 使用 glob 匹配文件（支持通配符）
  const matchedFiles = [];

  for (const pattern of fileInputs) {
    const files = await glob(pattern, { onlyFiles: true, caseSensitiveMatch: true });
    matchedFiles.push(...files);
  }

  if (matchedFiles.length === 0) {
    console.error(`错误：未找到匹配的文件：${fileInputs.join(", ")}`);
    process.exit(1);
  }

  console.log("导入 SQL 文件");
  console.log("============");
  console.log(`匹配到 ${matchedFiles.length} 个文件:`);
  matchedFiles.forEach(f => console.log(`  - ${f}`));
  console.log("");

  let totalSuccess = 0;
  let totalErrors = 0;
  const allErrorDetails = []; // 汇总所有文件的错误详情

  for (const file of matchedFiles) {
    console.log(`处理文件：${file}`);
    const statements = readSqlFile(file, config.dbType);
    console.log(`读取到 ${statements.length} 条 SQL 语句`);

    try {
      const result = await executeSqlStatements(conn, statements, config);
      totalSuccess += result.success;
      totalErrors += result.errors;

      // 收集错误详情（带上文件名）
      if (result.errorDetails && result.errorDetails.length > 0) {
        for (const err of result.errorDetails) {
          allErrorDetails.push({
            ...err,
            fileName: file,
          });
        }
      }
    } catch (err) {
      // 非 continue-on-error 模式下，某个文件失败会抛出错误并停止
      // 将当前已累积的错误也加入汇总
      if (allErrorDetails.length === 0 && result?.errorDetails) {
        for (const err of result.errorDetails) {
          allErrorDetails.push({
            ...err,
            fileName: file,
          });
        }
      }
      throw err;
    }
    console.log("");
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`导入完成！总计：${totalSuccess + totalErrors} 条语句，${totalSuccess} 成功，${totalErrors} 失败`);

  // --continue-on-error 模式下，汇总展示所有文件的错误
  if (allErrorDetails.length > 0 && config.continueOnError) {
    console.log("");
    console.log(`⚠️  共有 ${allErrorDetails.length} 条语句执行失败`);
    console.log("");

    // 按文件分组展示
    const errorsByFile = {};
    for (const err of allErrorDetails) {
      if (!errorsByFile[err.fileName]) {
        errorsByFile[err.fileName] = [];
      }
      errorsByFile[err.fileName].push(err);
    }

    const displayFileCount = Object.keys(errorsByFile).length;
    console.log(`以下 ${displayFileCount} 个文件有错误：`);
    console.log("");

    for (const [fileName, errors] of Object.entries(errorsByFile)) {
      console.log(`📁 ${fileName} (${errors.length} 条失败)`);
      console.log(`───────────────────────────────────────────────────────`);

      // 每个文件展示前 5 条错误
      const displayCount = Math.min(5, errors.length);
      for (let i = 0; i < displayCount; i++) {
        const err = errors[i];
        console.log(`  ❌ 第 ${err.index} 条语句 (文件第 ${err.lineNumber} 行):`);

        if (err.errorCode) {
          console.log(`     错误代码：${err.errorCode}`);
        }
        console.log(`     错误原因：${err.message}`);

        // 短 SQL 显示全部，长 SQL 显示前 200 字符
        if (err.sql.length <= 100) {
          console.log(`     SQL: ${err.sql}`);
        } else {
          console.log(`     SQL: ${err.sql.substring(0, 200)}...`);
        }
        console.log("");
      }

      if (errors.length > displayCount) {
        console.log(`  ... 还有 ${errors.length - displayCount} 条错误，请使用日志查看完整信息`);
      }
      console.log("");
    }
  }
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
    throw new Error("缺少 SQL 语句，请使用 -q/--query 指定");
  }

  // 验证 format 参数
  if (options.format) {
    const formatValue = options.format.toLowerCase();
    if (formatValue === "json") {
      config.format = "json";
    } else if (formatValue === "table") {
      config.format = "table";
    } else {
      throw new Error("--format 必须是 json 或 table");
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
        // MySQL: DDL 和管理命令使用 raw.query，其他使用 execute
        const result = conn.type === "mysql"
          ? await executeMySqlStatement(conn, statement)
          : await conn.execute(statement);

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

        // MySQL: DDL 和管理命令使用 raw.query，其他使用 execute
        const result = conn.type === "mysql"
          ? await executeMySqlStatement(conn, statement)
          : await conn.execute(statement);

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

// 全局连接选项（必填）
cli.option(
  "-c, --connection <string>",
  "数据库连接字符串\n                                  达梦数据库：dm://user:pass@host:port\n                                  MySQL: mysql://user:pass@host:port",
  { required: true },
);

// import 子命令
cli
  .command("import [...files]", "导入 SQL 文件到数据库")
  .option("-f, --file <path>", "SQL 文件路径（支持通配符，如 *.sql 或 **/*.sql）")
  .option("-s, --schema <name>", "Schema/数据库名称")
  .option("--continue-on-error", "遇到错误继续执行")
  .alias("i")
  .action(async (files, options) => {
    // 先验证 -f 和位置参数至少有一个（在连接数据库之前）
    const fileInputs = [];
    if (options.file) {
      if (Array.isArray(options.file)) {
        fileInputs.push(...options.file);
      } else {
        fileInputs.push(options.file);
      }
    }
    if (files && files.length > 0) {
      fileInputs.push(...files);
    }

    if (fileInputs.length === 0) {
      console.error(`错误：缺少必填参数 -f/--file`);
      console.error(`使用 --help 查看帮助信息`);
      process.exit(1);
    }

    const connInfo = validateConnection(options.connection);
    const conn = await createConnection(connInfo);
    console.log("数据库连接成功");

    // MySQL 需要先选择数据库
    if (conn.type === "mysql" && options.schema) {
      await conn.raw.query(`USE \`${options.schema}\``);
      console.log(`已选择数据库：${options.schema}`);
    }
    console.log("");

    // 合并 -f 选项和位置参数的文件路径
    const positionalFiles = files || [];
    await runImport(conn, options, positionalFiles);

    await conn.close();
  });

// 验证并解析连接字符串的辅助函数
function validateConnection(connStr) {
  // 空字符串视为未提供连接
  if (!connStr || connStr.trim() === "") {
    console.error(`错误：缺少必填参数 -c/--connection`);
    console.error(`使用 --help 查看帮助信息`);
    process.exit(1);
  }

  try {
    const connInfo = parseConnectionString(connStr);
    console.log(`连接数据库：${connInfo.host}:${connInfo.port}`);
    console.log(`用户：${connInfo.username}`);
    console.log(`类型：${connInfo.type === "mysql" ? "MySQL" : "达梦数据库"}`);
    console.log("");
    return connInfo;
  } catch (err) {
    console.error(`错误：${err.message}`);
    console.error(`使用 --help 查看帮助信息`);
    process.exit(1);
  }
}

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
    // 先验证必填参数（在连接数据库之前）
    if (!options.schema && !options.query) {
      console.error(`错误：缺少必填参数 -s/--schema 或 -q/--query`);
      console.error(`使用 --help 查看帮助信息`);
      process.exit(1);
    }

    const connInfo = validateConnection(options.connection);
    const conn = await createConnection(connInfo);
    console.log("数据库连接成功");
    console.log("");

    await runExport(conn, options);

    await conn.close();
  });

// exec 子命令
cli
  .command("exec", "执行 SQL 语句")
  .option("-q, --query <sql>", "SQL 语句")
  .option("--format <format>", "输出格式：json|table", { default: "table" })
  .option("--continue-on-error", "遇到错误继续执行")
  .alias("x")
  .action(async (options) => {
    // 先验证必填参数（在连接数据库之前）
    if (!options.query) {
      console.error(`错误：缺少必填参数 -q/--query`);
      console.error(`使用 --help 查看帮助信息`);
      process.exit(1);
    }

    const connInfo = validateConnection(options.connection);
    const conn = await createConnection(connInfo);
    console.log("数据库连接成功");
    console.log("");

    await runExec(conn, options);

    await conn.close();
  });

// 帮助信息（cac 自动生成）
cli.help();

// 统一错误处理
function handleCLIError(err) {
  const message = err.message || String(err);

  // 未知选项错误
  if (message.includes("Unknown option") || message.includes("unknown option")) {
    const optionMatch = message.match(/Unknown option[s]?\s+(?:`?([-\w]+)`?|([-\w]+))/i);
    const unknownOption = optionMatch ? (optionMatch[1] || optionMatch[2]) : "未知选项";
    console.error(`错误：无效的选项 ${unknownOption}`);
    console.error(`使用 --help 查看可用的选项`);
    process.exit(1);
  }

  // 缺少必填参数
  if (message.includes("Missing required option") || message.includes("missing required option")) {
    console.error(`错误：缺少必填参数 -c/--connection`);
    console.error(`使用 --help 查看帮助信息`);
    process.exit(1);
  }

  // 其他错误
  console.error(`错误：${message}`);
  console.error(`使用 --help 查看帮助信息`);
  process.exit(1);
}

// Only run CLI when executed directly (not when imported as module)
const isMainModule = process.argv[1] && process.argv[1].endsWith("db-cli.js");
if (isMainModule) {
  // 当没有任何参数时，显示主帮助
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0) {
    cli.outputHelp();
    process.exit(0);
  }

  // 解析命令行参数，捕获所有错误并显示友好提示
  try {
    cli.parse();
  } catch (err) {
    handleCLIError(err);
  }

  // 捕获未处理的拒绝
  process.on("unhandledRejection", (err) => {
    if (err instanceof Error) {
      console.error(`错误：${err.message}`);
    } else {
      console.error(`错误：${err}`);
    }
    console.error(`使用 --help 查看帮助信息`);
    process.exit(1);
  });
}
