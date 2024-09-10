const path = require("node:path");
const fs = require("node:fs/promises");

const { client } = require("../client");
const { writeSql } = require("../seed/services");
const { withTimeMeasureAsync } = require("../seed/utils");

(async () => {
  try {
    await client.connect();

    const dropTablesSql = await fs.readFile(
      path.join(__dirname, "../../sql/drop-tables.sql")
    );

    await withTimeMeasureAsync(writeSql)(dropTablesSql.toString());
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
})();
