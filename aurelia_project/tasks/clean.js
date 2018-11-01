import gulp from 'gulp';
import {CLIOptions} from 'aurelia-cli';
import project from '../aurelia.json';
// import {cwd} from 'process';
import del from 'del';

export default function clean() {
	// https://www.npmjs.com/package/del
	// del(['scripts#<{(|-bundle*.js', 'scripts#<{(|-bundle*.map'], {dryRun: false}).then(paths => {
	// 	console.log('Deleted files and folders:\n', paths.join('\n'));
	// 	console.log('Files and folders that would be deleted:\n', paths.join('\n'));
	// });
	console.log('Removing old build files...');
	let paths;
	try {
		// paths = del.sync(['scripts#<{(|-bundle-*.js', 'scripts#<{(|-bundle-*.map', 'scripts/app-bundle.js', 'scripts/app-bundle.map'], {dryRun: false});
		paths = del.sync(['scripts/*-bundle-*.js', 'scripts/*-bundle-*.map'], {dryRun: false});
	} catch (e) {
		console.log('Error:', e);
	}
	if(paths.length > 0) {
		console.log('Deleted files:');
		console.log(paths.join('\n'));
	}
	console.log(`${paths.length} files removed`);
	return gulp.src('src');
}
