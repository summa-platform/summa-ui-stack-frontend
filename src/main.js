require('node_modules/babel-polyfill/dist/polyfill.js'); // for async/await: $ npm install babel-polyfill --save

import environment from './environment';
import * as LogManager from 'aurelia-logging';
// import {ConsoleAppender} from 'aurelia-logging-console';
import AuthService from 'auth-service';

import 'whatwg-fetch';	// Fetch API polyfill

export function configure(aurelia) {

	// LogManager.addAppender(new ConsoleAppender());
	if(environment.debug) {
		LogManager.setLevel(LogManager.logLevel.debug);
	}

	aurelia.use
		.standardConfiguration()
		.feature('one-way-out')
		.feature('validation')
		.plugin('aurelia-animator-css')
		.plugin('aurelia-notify', settings => {
			settings.containerSelector = '#notification-container';
			settings.timeout = 5000;
		})
		.plugin('aurelia-hammer')
		.plugin('aurelia-bootstrap')
		.plugin('aurelia-bootstrap-datetimepicker', config => {
			// https://www.npmjs.com/package/aurelia-bootstrap-datetimepicker
			config.options.format = 'YYYY-MM-DD HH:mm:ss';
			config.options.showTodayButton = true;
			config.options.toolbarPlacement = 'top';
		})
		// .plugin('aurelia-bootstrap-select')
		.plugin('aurelia-google-maps', config => {
			config.options({
				apiKey: 'AIzaSyA7QtOydmmMrimXeev6nSoiY6K_QHQcFKw', // use `false` to disable the key
				apiLibraries: 'drawing,geometry,visualization', //get optional libraries like drawing, geometry, ... - comma seperated list

				// add google.maps.MapOptions on construct
				// see: https://developers.google.com/maps/documentation/javascript/3.exp/reference#MapOptions
				options: { panControl: true, panControlOptions: { position: 9 }, minZoom: 1, maxZoom: 20 },

				// default: uses browser configuration (recommended).
				// Set this parameter to set another language
				// see: https://developers.google.com/maps/documentation/javascript/localization
				language:'' | 'en',

				// default: it applies a default bias for application behavior towards the United States.
				// see: https://developers.google.com/maps/documentation/javascript/localization
				region: '' | 'US',

				markerCluster: {
					enable: false,

					// self-hosting this file is highly recommended, see: https://developers.google.com/maps/documentation/javascript/marker-clustering
					src: 'https://cdn.rawgit.com/googlemaps/v3-utility-library/99a385c1/markerclusterer/src/markerclusterer.js',

					// the base URL where the images representing the clusters will be found.
					// The full URL will be: `{imagePath}{[1-5]}`.`{imageExtension}` e.g. `foo/1.png`.
					// Self-hosting these images is highly recommended.
					// see: https://developers.google.com/maps/documentation/javascript/marker-clustering
					imagePath: 'https://cdn.rawgit.com/googlemaps/v3-utility-library/tree/master/markerclusterer/images/m',

					imageExtension: 'png',
				}
			});
		})
  		// .feature('resources/value-converters/iterable')
		.feature('resources');

	if (environment.debug) {
		aurelia.use.developmentLogging();
	}

	if (environment.testing) {
		aurelia.use.plugin('aurelia-testing');
	}

	// aurelia.start().then(() => aurelia.setRoot());
	// aurelia.start().then(() => aurelia.setRoot('login'));
	aurelia.start().then(async () => {
		let auth = aurelia.container.get(AuthService);
		let root = (await auth.isAuthenticated()) ? 'app' : 'login';
		// root = 'login';
		aurelia.setRoot(root);
	});
}
