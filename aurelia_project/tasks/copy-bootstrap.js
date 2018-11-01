// http://stackoverflow.com/questions/39271458/how-can-i-add-font-awesome-to-my-aurelia-project-using-npm
// http://stackoverflow.com/a/39544587
import gulp from 'gulp';
import merge from 'merge-stream';
import changedInPlace from 'gulp-changed-in-place';
import project from '../aurelia.json';

export default function copyBootstrap() {
  const source = 'node_modules/bootstrap/dist';

  const taskFonts = gulp.src(`${source}/fonts/*`)
    .pipe(changedInPlace({ firstPass: true }))
    .pipe(gulp.dest(`${project.platform.output}/../static/bootstrap/fonts`));

  const taskCSS = gulp.src(`${source}/css/*`)
    .pipe(changedInPlace({ firstPass: true }))
    .pipe(gulp.dest(`${project.platform.output}/../static/bootstrap/css`));

  return merge(taskFonts, taskCSS);
}
