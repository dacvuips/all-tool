// Script loop all changed files from git and run TS Hero extension optimizse imports command
// Usage: node ts-hero.js

// Allow pass dry run flag
const dryRun = process.argv[2] === '--dry-run';

// Get all changed files from git
const { execSync } = require('child_process');
const changedFiles = execSync('git diff --name-only --cached')
  .toString()
  .split('\n')
  // filter only ts files
  .filter(file => file.endsWith('.ts'));

// Run TS Hero extension optimizse imports command
const vscode = require('vscode');

// TS Hero extension id
const extensionId = 'rbbit.typescript-hero';
// TS Hero extension command
const command = 'typescriptHero.organize.imports';

// Get TS Hero extension
const extension = vscode.extensions.getExtension(extensionId);

// If TS Hero extension is installed
if (extension) {
  // Activate TS Hero extension
  extension.activate().then(() => {
    // Get TS Hero extension API
    const api = extension.exports;
    // Get TS Hero extension API commands
    const commands = api.commands;

    // Loop all changed files
    changedFiles.forEach(file => {
      console.log(file);
      if (!dryRun) {
        // Get TS Hero extension API command
        const command = commands.get(command);
        // Run TS Hero extension API command
        command.execute(file);
      }
    });
  });
}