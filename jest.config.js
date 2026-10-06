module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    '\\.m?[jt]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: [],
  collectCoverage: true,
  coverageProvider: 'v8',
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/jest.config.js',
    '!**/jest.setup.js',
    '!**/GEMINI*.js',
    '!**/jquery-ui/**',
    '!**/coverage/**',
  ],
};