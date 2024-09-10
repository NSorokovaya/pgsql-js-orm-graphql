const path = require("node:path");
const fs = require("node:fs/promises");

const { withTimeMeasureAsync } = require("../seed/utils");
const { writeSql } = require("../seed/services");
const { client } = require("../client");

(async () => {
  try {
    await client.connect();

    const createSql = await fs.readFile(
      path.join(__dirname, "../../sql/create-database.sql")
    );

    await withTimeMeasureAsync(writeSql)(createSql.toString());
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
})();
