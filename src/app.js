import {inject, bindable} from 'aurelia-framework';
import {Redirect} from 'aurelia-router';
import log from 'logger';
import html2canvas from 'html2canvas';
import {Services} from 'services';
import {CompositionService} from 'composition-service';
import {Store} from 'store';

@inject(Services, CompositionService, Store)
export class App {

	constructor(services, compositionService, store) {
		this.services = services;
		this.compositionService = compositionService;
		this.store = store;
		this.store.reset();
	}

	async configureRouter(config, router) {
		await this.store.ensureCurrentUser();
		this.router = router;
		let admin = this.store.currentUser.role === 'admin';
		// admin = true;
		config.title = 'SUMMA';
		// let entitiesNavigationStrategy = (instruction) => {
		// 	// console.log('FRAGMENT', instruction.fragment, instruction)
		// 	if(instruction.params.entityID) {
		// 		instruction.config.moduleId = 'entity';
		// 	}
		// };
		config.map([
			{ route: '', redirect: 'trending' },
			{ route: 'trending', name: 'trending', moduleId: 'trending/index', nav: true, title: 'Trending', settings: { svgicon: 'trending' } },
			{ route: ['live', 'live/:dateTime'], name: 'live', moduleId: 'live', nav: true, title: 'Live', settings: { glyphicon: 'list' } },
			// { route: ['entities', 'entities/:entityID', 'entities/search/:searchText'], name: 'entities', moduleId: 'entities',
			// 	navigationStrategy: entitiesNavigationStrategy, nav: true, title: 'Entities', settings: { svgicon: 'account-balance' } },
			{ route: 'entities', name: 'entities', moduleId: 'entities', nav: true, title: 'Entities',
				settings: { svgicon: 'account-balance', menu: 'entities' } },
			{ route: 'entities/search/:searchText?', name: 'entitiesSearch', moduleId: 'entities', nav: false, title: 'Entities',
				settings: { svgicon: 'account-balance', menu: 'entities' } },
			{ route: 'entities/:entityID', name: 'entity', moduleId: 'entity', nav: false, title: 'Entity',
				settings: { svgicon: 'account-balance', menu: 'entities' } },
			{ route: 'bookmarks', name: 'bookmarks', moduleId: 'bookmarks', nav: true, title: 'Bookmarks', settings: { svgicon: 'collections-bookmark' } },
			{ route: 'feeds', name: 'feeds', moduleId: 'feeds', nav: admin, title: 'Feeds', settings: { glyphicon: 'list' } },
			{ route: 'users', name: 'users', moduleId: 'users', nav: admin, title: 'Users', settings: { glyphicon: 'user' } },
			{ route: ['reports', 'reports/:reportID'], name: 'reports', moduleId: 'reports', nav: admin, title: 'Reports', settings: { glyphicon: 'envelope' } },
			// { route: 'reports/:reportID', name: 'report', moduleId: 'reports', nav: false, title: 'Reports', settings: { glyphicon: 'envelope' } },
			{ route: 'logout', name: 'logout', moduleId: 'logout', nav: true, title: 'Logout', settings: { glyphicon: 'off' } },
		]);
	}

	activate(params) {
		// log.debug('APP activate:', params);
	}

	attached() {
		this.store.currentView = 'app';
		this.tooltip = $('[data-toggle="tooltip"]').tooltip();
		// console.log('ROUTER:', this.router);
	}

	async feedback() {
		// this.tooltip.tooltip('hide');
		log.info('Generating preview...');
		let canvas = await html2canvas(document.body);
		log.info('Preview generated!');
		// let url = this.router.baseUrl + this.router.currentInstruction.fragment;
		let url = window.location.href;
		let [dialog, destroy] = await this.compositionService.create('dialogs/feedback-dialog');
		let feedback = await dialog.viewModel.open({
			screenshotBase64: canvas.toDataURL('image/png'),
			guiPath: url,
			includeScreenshot: true
		});
		destroy();

		if(feedback) {
			if(!feedback.includeScreenshot) {
				delete feedback.screenshotBase64;
			}
			delete feedback.includeScreenshot;

			feedback.user = this.store.currentUser.id;
			feedback.userName = this.store.currentUser.name;
			feedback.metadata = {};

			log.debug('Edited feedback item yet to be stored:', feedback);
			feedback = await this.store.addFeedbackItem(feedback);
			log.debug('Stored feedback item:', feedback);
		}
	}

	toggleAltTouch() {
		this.services.altTouch = this.altTouch = !this.altTouch;
	}
}
