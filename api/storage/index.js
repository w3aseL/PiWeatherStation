const mariadb = require('mariadb');

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER, 
  password: process.env.DB_PASSWORD,
  database: `WeatherData`,
  connectionLimit: 15
});

/**
 * Perform Database Operation
 * ---------
 * Hook function for performing operations on the database
 * 
 * @param {function(mariadb.Connection)} cb 
 */
const performDatabaseOperation = (cb) => {
  pool.getConnection()
    .then(conn => cb(conn))
    .catch(err => console.log(err))
}

setTimeout(() => {
  performDatabaseOperation(conn => {
    console.log('successful connection')
    conn.end()
  })
}, 3000)

module.exports = {
  performDatabaseOperation
}