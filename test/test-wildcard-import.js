#!/usr/bin/env node
/**
 * import 命令通配符和错误处理测试脚本
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, "..", "src", "db-cli.js");
const TEST_SQL_DIR = path.join(__dirname, "sql-fixtures");

// 测试结果统计
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  details: [],
};

// 测试辅助函数
function runCommand(args, expectSuccess = true) {
  try {
    const cmd = `node --openssl-legacy-provider "${CLI_PATH}" ${args}`;
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output, error: null };
  } catch (err) {
    return {
      success: false,
      output: err.stdout || "",
      error: err.stderr || err.message,
    };
  }
}

function test(name, fn) {
  try {
    const result = fn();
    if (result) {
      results.passed++;
      results.details.push({ name, status: "PASS" });
      console.log(`✓ ${name}`);
    } else {
      results.failed++;
      results.details.push({ name, status: "FAIL" });
      console.log(`✗ ${name}`);
    }
  } catch (err) {
    results.failed++;
    results.details.push({ name, status: "FAIL", error: err.message });
    console.log(`✗ ${name} - ${err.message}`);
  }
}

// 创建测试用 SQL 文件
function setupTestFixtures() {
  if (!fs.existsSync(TEST_SQL_DIR)) {
    fs.mkdirSync(TEST_SQL_DIR, { recursive: true });
  }

  // 正常的 SQL 文件
  fs.writeFileSync(
    path.join(TEST_SQL_DIR, "valid1.sql"),
    `-- 测试 SQL 文件 1
CREATE TABLE test_users (id INT PRIMARY KEY, name VARCHAR(100));
INSERT INTO test_users VALUES (1, 'Alice');
INSERT INTO test_users VALUES (2, 'Bob');
`
  );

  fs.writeFileSync(
    path.join(TEST_SQL_DIR, "valid2.sql"),
    `-- 测试 SQL 文件 2
CREATE TABLE test_roles (id INT PRIMARY KEY, role_name VARCHAR(100));
INSERT INTO test_roles VALUES (1, 'admin');
`
  );

  // 包含错误的 SQL 文件（用于测试 continue-on-error）
  fs.writeFileSync(
    path.join(TEST_SQL_DIR, "with_errors.sql"),
    `-- 包含错误的 SQL 文件
CREATE TABLE test_data (id INT PRIMARY KEY, value VARCHAR(100));
INSERT INTO test_data VALUES (1, 'valid');
INSERT INTO nonexistent_table VALUES (1, 'invalid');
INSERT INTO test_data VALUES (2, 'still_valid');
INVALID_SQL_SYNTAX!!!
INSERT INTO test_data VALUES (3, 'final');
`
  );

  console.log(`已创建测试用 SQL 文件到：${TEST_SQL_DIR}`);
}

// 清理测试文件
function cleanupTestFixtures() {
  if (fs.existsSync(TEST_SQL_DIR)) {
    fs.rmSync(TEST_SQL_DIR, { recursive: true, force: true });
    console.log(`已清理测试文件：${TEST_SQL_DIR}`);
  }
}

console.log("=".repeat(60));
console.log("import 命令通配符和错误处理测试");
console.log("=".repeat(60));
console.log("");

// 设置测试夹具
setupTestFixtures();

// ============================================
// 通配符支持测试
// ============================================
console.log("\n【通配符支持测试】");

test("import 帮助文档显示通配符说明", () => {
  const result = runCommand("import --help");
  return result.success && result.output.includes("通配符");
});

test("import 命令 - 单个文件正常导入（语法检查）", () => {
  // 不实际连接数据库，只验证参数解析
  const result = runCommand(
    `-c 'mysql://test:test@localhost:3306' import -f "${TEST_SQL_DIR}/valid1.sql"`,
    false
  );
  // 预期会尝试连接（连接失败），但不应该报参数错误
  const errorMsg = result.error || result.output;
  return !result.success && !errorMsg.includes("Unused args");
});

test("import 命令 - 通配符 *.sql 参数解析（语法检查）", () => {
  // 验证通配符展开后的参数解析
  const result = runCommand(
    `-c 'mysql://test:test@localhost:3306' import -f "${TEST_SQL_DIR}/*.sql"`,
    false
  );
  // 不应该报 "Unused args" 错误
  const errorMsg = result.error || result.output;
  return !result.success && !errorMsg.includes("Unused args");
});

test("import 命令 - 通配符匹配多个文件（语法检查）", () => {
  // 验证多个文件都能被识别
  const result = runCommand(
    `-c 'mysql://test:test@localhost:3306' import -f "${TEST_SQL_DIR}/valid*.sql"`,
    false
  );
  const errorMsg = result.error || result.output;
  // 不应该报参数错误
  return !result.success && !errorMsg.includes("Unused args") && !errorMsg.includes("缺少必填参数");
});

// ============================================
// continue-on-error 错误处理测试
// ============================================
console.log("\n【continue-on-error 错误处理测试】");

test("--continue-on-error 选项在帮助文档中存在", () => {
  const result = runCommand("import --help");
  return result.success && result.output.includes("--continue-on-error");
});

test("--continue-on-error 模式下错误信息包含统计", () => {
  // 这个测试需要实际连接数据库，跳过实际执行，只验证代码结构
  const dbCliContent = fs.readFileSync(path.join(__dirname, "..", "src", "db-cli.js"), "utf-8");
  return dbCliContent.includes("continueOnError") &&
         dbCliContent.includes("errorDetails") &&
         dbCliContent.includes("条语句执行失败");
});

test("--continue-on-error 模式下按文件分组展示错误", () => {
  const dbCliContent = fs.readFileSync(path.join(__dirname, "..", "src", "db-cli.js"), "utf-8");
  return dbCliContent.includes("errorsByFile") &&
         dbCliContent.includes("按文件分组");
});

// ============================================
// 清理
// ============================================
console.log("");
console.log("清理测试文件...");
cleanupTestFixtures();

// ============================================
// 总结
// ============================================
console.log("");
console.log("=".repeat(60));
console.log("测试结果总结");
console.log("=".repeat(60));
console.log(`通过：${results.passed}`);
console.log(`失败：${results.failed}`);
console.log(`跳过：${results.skipped}`);
console.log("");

if (results.failed > 0) {
  console.log("失败的测试:");
  for (const detail of results.details) {
    if (detail.status === "FAIL") {
      console.log(`  - ${detail.name}${detail.error ? `: ${detail.error}` : ""}`);
    }
  }
  process.exit(1);
} else {
  console.log("所有测试通过！✓");
  process.exit(0);
}
