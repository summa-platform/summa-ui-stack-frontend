import gulp from 'gulp';
import build from './build';
import copy from './copy';
import clean from './clean';

import {CLIOptions} from 'aurelia-cli';
import del from 'del';

function deploy_clean() {
	const output = CLIOptions.getFlagValue('out', 'o');
	if (!output) {
		throw new Error('--out argument is required');
	}
	console.log('Removing deployment files...');
	let paths = del.sync([output+'/**/*'], {dryRun: false, force: true});
	// console.log('Deleted files:');
	// console.log(paths.join('\n'));
	console.log(`${paths.length} files removed`);
	return gulp.src('.');
}

export default gulp.series(
	clean,
	build,
	deploy_clean,
	copy
);
