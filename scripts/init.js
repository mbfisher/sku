#!/usr/bin/env node

const pkg = require('../package.json');
const commander = require('commander');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const emptyDir = require('empty-dir');
const validatePackageName = require('validate-npm-package-name');
const kopy = require('kopy');
const dedent = require('dedent');

const detectYarn = require('../lib/detectYarn');
const install = require('../lib/install');

let projectName;

const program = new commander.Command(pkg.name)
  .version(pkg.version)
  .arguments('<project-directory>')
  .usage(`${chalk.green('<project-directory>')} [options]`)
  .action(name => {
    projectName = name;
  })
  .option('--verbose', 'print additional logs')
  .parse(process.argv);

if (typeof projectName === 'undefined') {
  console.error('Please specify the project directory:');

  console.log(
    `  ${chalk.cyan(program.name())} ${chalk.green('<project-directory>')}`
  );
  console.log();
  console.log('For example:');
  console.log(`  ${chalk.cyan(program.name())} ${chalk.green('my-seek-ui')}`);
  console.log();
  console.log(
    `Run ${chalk.cyan(`${program.name()} --help`)} to see all options.`
  );
  process.exit(1);
}

const verbose = program.verbose;

const root = path.resolve(projectName);
const appName = path.basename(root);

const reservedNames = ['react', 'react-dom', 'sku', 'seek-style-guide'].sort();

const { validForNewPackages, errors = [], warnings = [] } = validatePackageName(
  appName
);

if (!validForNewPackages) {
  console.error(dedent`
    Could not create a project called ${chalk.red(`"${appName}"`)} \
    because of npm naming restrictions:
  `);

  const results = [...errors, ...warnings];
  results.forEach(result => console.error(chalk.red(`  *  ${result}`)));

  process.exit(1);
}

if (reservedNames.indexOf(appName) >= 0) {
  console.error(
    chalk.red(dedent`
      We cannot create a project called \
      ${chalk.green(appName)} \
      because a dependency with the same name exists.
      Due to the way npm works, the following names are not allowed:

      ${chalk.cyan(reservedNames.map(depName => `  ${depName}`).join('\n'))}

      Please choose a different project name.
    `)
  );
  process.exit(1);
}

fs.ensureDirSync(projectName);

if (!emptyDir.sync(root)) {
  console.log(`The directory ${chalk.green(projectName)} is not empty.`);
  process.exit(1);
}

console.log(`Creating a new SEEK UI project in ${chalk.green(root)}.`);
console.log();

const packageJson = {
  name: appName,
  version: '0.1.0',
  private: true,
  scripts: {
    start: 'sku start',
    test: 'sku test',
    build: 'sku build',
    lint: 'sku lint',
    format: 'sku format'
  }
};
const packageJsonString = JSON.stringify(packageJson, null, 2);

fs.writeFileSync(path.join(root, 'package.json'), packageJsonString);
process.chdir(root);

const useYarn = detectYarn();

const allDeps = [
  'seek-style-guide',
  'sku',
  'react',
  'react-dom',
  'react-helmet'
];

console.log('Installing packages. This might take a couple of minutes.');
console.log(`Installing ${allDeps.map(x => chalk.cyan(x)).join(', ')}...`);
console.log();

install(allDeps, verbose, useYarn)
  .then(() => {
    return kopy(path.join(__dirname, '../template'), root, {
      move: {
        // Remove leading underscores from filenames:
        '_*': filepath => filepath.replace(/^_/, '')
      },
      data: {
        appName,
        gettingStartedDocs: useYarn
          ? dedent`
            First of all, make sure you've installed [Yarn](https://yarnpkg.com).

            Then, install dependencies:

            \`\`\`bash
            $ yarn
            \`\`\`
            `
          : dedent`
            Install dependencies:

            \`\`\`bash
            $ npm install
            \`\`\`
            `,
        startScript: useYarn ? 'yarn start' : 'npm start',
        testScript: useYarn ? 'yarn test' : 'npm test',
        lintScript: useYarn ? 'yarn lint' : 'npm run lint',
        formatScript: useYarn ? 'yarn format' : 'npm run format',
        buildScript: useYarn ? 'yarn build' : 'npm run build'
      }
    });
  })
  .then(() => console.log('Success!'));
