module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  setupFilesAfterSetup: ['./test/setup.js'],
  testTimeout: 15000,
};
