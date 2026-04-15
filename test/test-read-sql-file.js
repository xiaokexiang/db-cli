/**
 * 测试 readSqlFile 函数返回的行号信息
 */
import fs from "fs";
import { readSqlFile } from "../src/db-cli.js";

console.log("测试 readSqlFile 函数的行号记录功能\n");

// 创建一个测试 SQL 文件
const testSqlContent = `-- 测试 SQL 文件
-- 第 3 行

-- 第 5 行：第一条语句
SELECT 1;

-- 第 8 行：第二条语句
SELECT 2;

-- 第 11 行：第三条语句（多行）
SELECT *
FROM table1
WHERE id = 1;

-- 第 16 行：第四条语句
SELECT 4;
`;

const testFilePath = "./test-temp.sql";
fs.writeFileSync(testFilePath, testSqlContent, "utf-8");

try {
  const statements = readSqlFile(testFilePath, "mysql");

  console.log(`解析到 ${statements.length} 条语句\n`);

  let allTestsPassed = true;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`语句 ${i + 1}:`);
    console.log(`  行号范围：${stmt.startLine}-${stmt.endLine}`);
    console.log(`  SQL: ${stmt.sql.substring(0, 50)}...`);

    // 验证返回格式
    if (typeof stmt !== "object") {
      console.log(`  ❌ 错误：语句应该是对象格式`);
      allTestsPassed = false;
    }
    if (!stmt.sql) {
      console.log(`  ❌ 错误：缺少 sql 属性`);
      allTestsPassed = false;
    }
    if (!stmt.startLine || !stmt.endLine) {
      console.log(`  ❌ 错误：缺少 startLine 或 endLine 属性`);
      allTestsPassed = false;
    }
    console.log("");
  }

  // 验证特定期望的行号
  console.log("验证特定期望的行号:");

  // 第一条语句 "SELECT 1;" 应该在第 5 行（注释和空行被跳过）
  const stmt1 = statements[0];
  if (stmt1.startLine === 5 && stmt1.endLine === 5) {
    console.log(`  ✓ 第一条语句行号正确 (第 5 行)`);
  } else {
    console.log(`  ❌ 第一条语句行号错误，期望 5-5, 实际 ${stmt1.startLine}-${stmt1.endLine}`);
    allTestsPassed = false;
  }

  // 第二条语句 "SELECT 2;" 应该在第 8 行
  const stmt2 = statements[1];
  if (stmt2.startLine === 8 && stmt2.endLine === 8) {
    console.log(`  ✓ 第二条语句行号正确 (第 8 行)`);
  } else {
    console.log(`  ❌ 第二条语句行号错误，期望 8-8, 实际 ${stmt2.startLine}-${stmt2.endLine}`);
    allTestsPassed = false;
  }

  // 第三条语句 (多行) 应该在第 11-13 行
  const stmt3 = statements[2];
  if (stmt3.startLine === 11 && stmt3.endLine === 13) {
    console.log(`  ✓ 第三条语句行号正确 (第 11-13 行)`);
  } else {
    console.log(`  ❌ 第三条语句行号错误，期望 11-13, 实际 ${stmt3.startLine}-${stmt3.endLine}`);
    allTestsPassed = false;
  }

  // 第四条语句 "SELECT 4;" 应该在第 16 行
  const stmt4 = statements[3];
  if (stmt4.startLine === 16 && stmt4.endLine === 16) {
    console.log(`  ✓ 第四条语句行号正确 (第 16 行)`);
  } else {
    console.log(`  ❌ 第四条语句行号错误，期望 16-16, 实际 ${stmt4.startLine}-${stmt4.endLine}`);
    allTestsPassed = false;
  }

  console.log("");
  if (allTestsPassed) {
    console.log("所有测试通过！✓");
  } else {
    console.log("部分测试失败！❌");
    process.exit(1);
  }
} finally {
  // 清理测试文件
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
  }
}
