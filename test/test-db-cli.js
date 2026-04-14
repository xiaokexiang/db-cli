#!/usr/bin/env node
/**
 * db-cli 命令测试脚本
 * 测试所有命令的基本功能
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// db-cli.js 在 src 目录下 (相对于 test 目录)
const CLI_PATH = path.join(__dirname, "..", "src", "db-cli.js");

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

console.log("=".repeat(50));
console.log("db-cli 命令测试");
console.log("=".repeat(50));
console.log("");

// ============================================
// 1. 帮助命令测试
// ============================================
console.log("\n【帮助命令测试】");

test("显示主帮助菜单", () => {
  const result = runCommand("--help");
  return result.success && result.output.includes("db-cli");
});

test("显示 exec 命令帮助", () => {
  const result = runCommand("exec --help");
  return result.success && result.output.includes("-q, --query");
});

test("显示 import 命令帮助", () => {
  const result = runCommand("import --help");
  return result.success && result.output.includes("-f, --file");
});

test("显示 export 命令帮助", () => {
  const result = runCommand("export --help");
  return result.success && result.output.includes("-s, --schema");
});

// ============================================
// 2. 参数验证测试
// ============================================
console.log("\n【参数验证测试】");

test("缺少连接字符串时显示错误", () => {
  // 需要使用引号包裹 SQL 语句，否则 1 会被当作额外参数
  const result = runCommand('exec -q "SELECT 1"', false);
  const errorMsg = result.error || result.output;
  return !result.success && errorMsg.includes("缺少必填参数");
});

test("不认识的命令显示错误", () => {
  const result = runCommand("unknown-command", false);
  const errorMsg = result.error || result.output;
  return !result.success && errorMsg.includes("不识别的命令");
});

// ============================================
// 3. 连接字符串解析测试
// ============================================
console.log("\n【连接字符串解析测试】");

test("MySQL 格式连接字符串可解析", () => {
  const result = runCommand("-c mysql://user:pass@localhost:3306 exec", false);
  // 只要不显示格式错误即可，连接失败是预期的
  const errorMsg = result.error || result.output;
  return !result.success && !errorMsg.includes("连接字符串格式错误");
});

test("达梦数据库格式连接字符串可解析", () => {
  const result = runCommand("-c dm://user:pass@localhost:5236 exec", false);
  const errorMsg = result.error || result.output;
  return !result.success && !errorMsg.includes("连接字符串格式错误");
});

test("无效连接字符串格式显示错误", () => {
  const result = runCommand("-c invalid://user:pass@localhost:3306 exec", false);
  const errorMsg = result.error || result.output;
  return !result.success && errorMsg.includes("连接字符串格式错误");
});

// ============================================
// 4. exec 命令测试（语法验证）
// ============================================
console.log("\n【exec 命令测试】");

test("exec 命令 - 提供连接字符串但无 SQL 语句", () => {
  // 当前行为：代码在连接建立后才检查 SQL，所以会先尝试连接
  const result = runCommand("-c mysql://user:pass@localhost:3306 exec", false);
  // 预期会尝试连接（连接会失败）
  return !result.success;
});

// ============================================
// 5. import 命令测试（语法验证）
// ============================================
console.log("\n【import 命令测试】");

test("import 命令 - 提供连接字符串但无文件参数", () => {
  const result = runCommand("-c mysql://user:pass@localhost:3306 import", false);
  return !result.success;
});

// ============================================
// 6. export 命令测试（语法验证）
// ============================================
console.log("\n【export 命令测试】");

test("export 命令 - 提供连接字符串但无 schema 参数", () => {
  const result = runCommand("-c mysql://user:pass@localhost:3306 export", false);
  return !result.success;
});

// ============================================
// 7. 代码语法检查
// ============================================
console.log("\n【代码语法检查】");

test("db-cli.js 语法检查", () => {
  try {
    execSync(`node --check "${CLI_PATH}"`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
    return true;
  } catch (err) {
    console.log(`  语法错误：${err.message}`);
    return false;
  }
});

// ============================================
// 8. 连接字符串格式验证
// ============================================
console.log("\n【连接字符串格式验证】");

test("MySQL 连接字符串格式正确解析", () => {
  const result = runCommand("-c 'mysql://root:password@localhost:3306' exec -q 'SELECT 1'", false);
  const errorMsg = result.error || result.output;
  // 应该解析成功，连接失败（ECONNREFUSED 或 getaddrinfo）
  return !result.success && !errorMsg.includes("连接字符串格式错误");
});

test("达梦连接字符串格式正确解析", () => {
  const result = runCommand("-c 'dm://SYSDBA:SYSDBA@localhost:5236' exec -q 'SELECT 1'", false);
  const errorMsg = result.error || result.output;
  return !result.success && !errorMsg.includes("连接字符串格式错误");
});

// ============================================
// 总结
// ============================================
console.log("");
console.log("=".repeat(50));
console.log("测试结果总结");
console.log("=".repeat(50));
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
