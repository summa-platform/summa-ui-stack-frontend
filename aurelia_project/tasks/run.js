import gulp from 'gulp';
import browserSync from 'browser-sync';
import historyApiFallback from 'connect-history-api-fallback/lib';
import {CLIOptions} from 'aurelia-cli';
import project from '../aurelia.json';
import build from './build';
import watch from './watch';
import url from 'url';
import proxy from 'proxy-middleware';
import apiconf from '../../api-proxy.json';

// http://stackoverflow.com/questions/25410284/gulp-browser-sync-redirect-api-request-via-proxy
let apiOptions = url.parse(apiconf.api);
apiOptions.route = '/api';
let videoChunksOptions = url.parse(apiconf.video_chunks);
videoChunksOptions.route = '/video-chunks';

let serve = gulp.series(
  build,
  done => {
    browserSync({
      online: false,
      open: false,
      port: 9000,
      logLevel: 'silent',
      server: {
        baseDir: [project.platform.baseDir],
        middleware: [proxy(apiOptions), proxy(videoChunksOptions), historyApiFallback(), function(req, res, next) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          next();
        }]
      },
	  ghostMode: false	// https://browsersync.io/docs/options
    }, function(err, bs) {
      if (err) return done(err);
      let urls = bs.options.get('urls').toJS();
      log(`Application Available At: ${urls.local}`);
      log(`BrowserSync Available At: ${urls.ui}`);
      done();
    });
  }
);

function log(message) {
  console.log(message); //eslint-disable-line no-console
}

function reload() {
  log('Refreshing the browser');
  browserSync.reload();
}

let run;

if (CLIOptions.hasFlag('watch')) {
  run = gulp.series(
    serve,
    done => { watch(reload); done(); }
  );
} else {
  run = serve;
}

export default run;
