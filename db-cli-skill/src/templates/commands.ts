import type { CommandTemplate } from "./matcher.js";

/**
 * Natural language command templates for database operations
 * Each template maps user intents to specific tool calls
 */

/**
 * Count rows in a table
 * Patterns: "how many rows", "count records", etc.
 */
export const countTemplate: CommandTemplate = {
  name: "count",
  patterns: [
    // "How many rows in table X?"
    /\bhow\s+(many|much)\s+(rows|records|data|entries)\s+(in|from)\s+(?:table\s+)?['"`]?([\w-]+)['"`]?/i,
    // "Count records from X"
    /\b(count|show\s+count|get\s+count)\s+(?:of\s+)?(?:rows\s+in\s+|records\s+from\s+|data\s+in\s+)?['"`]?([\w-]+)['"`]?/i,
    // "What is the count of X table"
    /\bwhat\s+(?:is|'s)\s+(?:the\s+)?(?:count|number|total)\s+(?:of|for)\s+(?:table\s+)?['"`]?([\w-]+)['"`]?/i,
    // "Total rows in X"
    /\b(total|sum)\s+(?:rows\s+)?(?:in|from)\s+(?:table\s+)?['"`]?([\w-]+)['"`]?/i,
  ],
  extractParams: (match: RegExpMatchArray): Record<string, string> => {
    // Pattern 1 has 4 groups (table in [4]), patterns 2-4 have 2 groups (table in [2])
    const tableName = match[4] || match[2] || "";
    return { table: tableName.replace(/['"`]/g, "") };
  },
  requiredParams: ["table"],
};

/**
 * Describe table structure
 * Patterns: "show structure", "describe table", etc.
 */
export const descTemplate: CommandTemplate = {
  name: "desc",
  patterns: [
    // "Show structure of table X" / "Show me the structure of table X"
    /\b(?:show|display|view)\s+(?:me\s+)?(?:the\s+)?(?:structure|schema|columns|fields)\s+(?:of|for)\s+(?:table\s+)?['"`]?([\w-]+)['"`]?/i,
    // "Describe table X"
    /\b(describe|desc)\s+(?:table\s+)?['"`]?([\w-]+)['"`]?/i,
    // "What columns are in table X"
    /\bwhat\s+(?:columns|fields)\s+(?:are\s+)?(?:in|from)\s+(?:table\s+)?['"`]?([\w-]+)['"`]?/i,
    // "Table X structure"
    /\b(?:table\s+)?['"`]?([\w-]+)['"`]?\s+(?:structure|schema|columns)\b/i,
    // "Show indexes of table X"
    /\b(show|display|view)\s+(?:me\s+)?(?:the\s+)?(?:index(?:es)?|keys)\s+(?:of|for|in)\s+(?:table\s+)?['"`]?([\w-]+)['"`]?/i,
    // "Show foreign keys of table X"
    /\b(show|display|view)\s+(?:me\s+)?(?:the\s+)?(?:foreign\s+keys?|FK|foreign key constraints)\s+(?:of|for|in)\s+(?:table\s+)?['"`]?([\w-]+)['"`]?/i,
  ],
  extractParams: (match: RegExpMatchArray): Record<string, string> => {
    // Pattern 1,5,6 have 1 group (table in [1]); pattern 2 has 2 groups (table in [2]); patterns 3,4 have 1 group
    const fullMatch = match[0].toLowerCase();
    let tableName = "";
    let intent = "";

    if (fullMatch.startsWith("describe") || fullMatch.startsWith("desc")) {
      // Pattern 2: table in [2]
      tableName = match[2] || match[1] || "";
      intent = match[1]?.toLowerCase() || "";
    } else {
      // Other patterns: table in [1]
      tableName = match[1] || "";
      intent = fullMatch.split(" ")[0];
    }

    const params: Record<string, string> = { table: tableName.replace(/['"`]/g, "") };

    // Detect if user wants indexes
    if (intent.includes("index") || intent.includes("key")) {
      params.showIndexes = "true";
    }
    // Detect if user wants foreign keys
    if (intent.includes("foreign") || intent.includes("FK")) {
      params.showForeignKeys = "true";
    }

    return params;
  },
  requiredParams: ["table"],
};

/**
 * Export table data or query results
 * Patterns: "export table", "backup data", etc.
 */
export const exportTemplate: CommandTemplate = {
  name: "export",
  patterns: [
    // "Export table X to file Y"
    /\bexport\s+(?:table\s+)?['"`]?([\w-]+)['"`]?\s+(?:to|into|as)\s+(?:file\s+)?['"`]?([\w./\\-]+)['"`]?/i,
    // "Backup table X"
    /\b(?:backup|dump|save)\s+(?:table\s+)?(?:data\s+from\s+)?['"`]?([\w-]+)['"`]?/i,
    // "Export data from table X"
    /\bexport\s+(?:data\s+)?(?:from|of)\s+(?:table\s+)?['"`]?([\w-]+)['"`]?/i,
    // "Download table X as CSV/SQL"
    /\b(?:download|get)\s+(?:table\s+)?['"`]?([\w-]+)['"`]?\s+(?:as|in)\s+(csv|sql|json)\b/i,
    // "Export query: SELECT..."
    /\bexport\s+(?:query|result(?:s)?(?::\s*)?)['"`]?\s*(SELECT[^'`"]*)['"`]?/i,
  ],
  extractParams: (match: RegExpMatchArray): Record<string, string> => {
    const params: Record<string, string> = {};

    // Determine what's being exported based on the pattern used
    const fullMatch = match[0].toLowerCase();

    if (fullMatch.includes("query") || fullMatch.includes("result")) {
      // Pattern 5: Exporting a query - query text in group 1
      params.query = match[1] || "";
    } else if (fullMatch.includes("download") || fullMatch.includes(" as ")) {
      // Pattern 4: Download with format - table in [1], format in [2]
      params.table = match[1]?.replace(/['"`]/g, "") || "";
      if (match[2]) {
        params.format = match[2].toLowerCase();
      }
    } else if (/^(backup|dump|save)\b/i.test(fullMatch)) {
      // Pattern 2: Starts with backup/dump/save - table name in group 1
      params.table = match[1]?.replace(/['"`]/g, "") || "";
    } else if (fullMatch.includes("export") && (fullMatch.includes("from") || fullMatch.includes("of"))) {
      // Pattern 3: Export from/of - table in group 1
      params.table = match[1]?.replace(/['"`]/g, "") || "";
    } else {
      // Pattern 1: Export X to Y - table in [1], output in [2]
      params.table = match[1]?.replace(/['"`]/g, "") || "";
      if (match[2]) {
        params.output = match[2].replace(/['"`]/g, "");
      }
    }

    return params;
  },
  requiredParams: ["output"], // Either table+output or query+output
};

/**
 * Import data from SQL file
 * Patterns: "import SQL file", "load data", etc.
 */
export const importTemplate: CommandTemplate = {
  name: "import",
  patterns: [
    // "Import SQL file X"
    /\bimport\s+(?:SQL\s+)?(?:file\s+)?['"`]?([\w./\\-]+\.sql)['"`]?/i,
    // "Load data from file X"
    /\bload\s+(?:data\s+)?(?:from\s+)?(?:file\s+)?['"`]?([\w./\\-]+)['"`]?/i,
    // "Run SQL file X"
    /\b(?:run|execute)\s+(?:SQL\s+)?(?:file\s+)?['"`]?([\w./\\-]+\.sql)['"`]?/i,
    // "Restore table X from file Y"
    /\brestore\s+(?:table\s+)?['"`]?([\w-]+)['"`]?\s+(?:from\s+)?(?:file\s+)?['"`]?([\w./\\-]+)['"`]?/i,
  ],
  extractParams: (match: RegExpMatchArray): Record<string, string> => {
    const params: Record<string, string> = {};

    const fullMatch = match[0].toLowerCase();

    if (fullMatch.includes("restore")) {
      // Restore pattern: table in group 1, file in group 2
      params.table = match[1]?.replace(/['"`]/g, "") || "";
      params.file = match[2]?.replace(/['"`]/g, "") || "";
    } else {
      // Other patterns: file in group 1
      params.file = match[1]?.replace(/['"`]/g, "") || "";
    }

    return params;
  },
  requiredParams: ["file"],
};

/**
 * Execute arbitrary SQL
 * Patterns: "run SQL", "execute query", etc.
 */
export const execTemplate: CommandTemplate = {
  name: "exec",
  patterns: [
    // "Run SQL: SELECT..." - capture everything after the colon/command
    /\b(?:run|execute)\s+(?:SQL|query)(?:\s*:\s*|\s+)(.+)/i,
    // "Execute: SELECT..."
    /\bexecute(?:\s*:\s*)(.+)/i,
    // Direct SQL statements (starting with SQL keywords) - capture the rest of the line
    /^\s*(SELECT\s+.+)$/i,
    // "Query: SELECT..."
    /\bquery(?:\s*:\s*)(.+)/i,
  ],
  extractParams: (match: RegExpMatchArray): Record<string, string> => {
    // Capture the SQL from group 1 (or full match for direct SQL)
    let sql = match[1] || match[0];

    // Clean up leading/trailing whitespace and quotes
    sql = sql.trim().replace(/^['"`]|['"`]$/g, "").trim();

    return { sql };
  },
  requiredParams: ["sql"],
};

/**
 * All command templates exported as array
 */
export const ALL_TEMPLATES: CommandTemplate[] = [
  countTemplate,
  descTemplate,
  exportTemplate,
  importTemplate,
  execTemplate,
];
