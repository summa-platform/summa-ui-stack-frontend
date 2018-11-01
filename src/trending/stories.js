import {inject, bindable, observable} from 'aurelia-framework';
import {Router, Redirect} from 'aurelia-router';
import log from 'logger';
import {Store} from 'store';
import {Services} from 'services';
import moment from 'moment';
import {BindingEngine} from 'aurelia-framework';


@inject(BindingEngine, Store, Router, Services)
export class Stories {

	selectedStory;
	stories = [];

	@observable sortBy = 'most';
	filterSettings = { article: true, audio: true, video: true, latest: undefined,
		languages: { lv: true, en: true, de: true, ar: true, ru: true, es: true } };
	subscriptions = [];

	constructor(bindingEngine, store, router, services) {
		this.bindingEngine = bindingEngine;
		this.store = store;
		this.router = router;
		this.services = services;
	}

	async activate(params, routeConfig, navigationInstruction) {
		this.params = params;
		this.routeConfig = routeConfig;
		// this.navigationInstruction = navigationInstruction;

		// fast
		if(this.services.query) {
			this.query = this.services.query;
		}

		// this.query = await this.store.getQueryStories(this.params.queryID);
		// better non-blocking approach:
		this.queryPromise = this.store.getQueryStories(this.params.queryID).then(query => { this.query = query; this.services.query = query; });
		this.queryPromise.then(() => {
			// this.stories = this.query.stories;
			this.filter();
			return;
			for(const story of this.query.stories) {
				// media types
				const types = [];
				const mediaItemTypes = story.mediaItemTypes;
				for(const typ of Object.keys(mediaItemTypes)) {
					if(typ !== 'unknown') {
						types.push({name: typ, count: mediaItemTypes[typ]});	// TODO: append icon name ?
					}
				}
				story.types = types;
				// languages
				const languages = [];
				const mediaItemLangs = story.mediaItemLangs;
				for(const lang of Object.keys(mediaItemLangs)) {
					if(lang !== 'unknown') {
						languages.push({code: lang, count: mediaItemLangs[lang]});
					}
				}
				story.languages = languages;
			}
		});

		// To test if await here blocks loading of page
		// await new Promise((resolve, reject) => {
		// 	setTimeout(() => resolve(), 5000);
		// });
		
		// moved from to attached() because at this point the current route is not yet set up properly
		// if(this.params.storyID) {
		// 	let storyID = this.params.storyID;
		// 	this.queryPromise.then(query => {
		// 		let story = query.stories.find(story => story.id === storyID);
		// 		if(story) {
		// 			this.selectStory(story);
		// 		}
		// 	});
		// }
	}

	attached() {
		// Select specified by URL:
		// moved from activate() because route was not correctly set up, so navigate does not work correctly from activate
		// if(this.params.storyID) {
		// 	let storyID = this.params.storyID;
		// 	this.queryPromise.then(query => {
		// 		let story = query.stories.find(story => story.id === storyID);
		// 		if(story) {
		// 			this.selectStory(story);
		// 		}
		// 	});
		// }


		let cb = () => this.filterSettingsChanged();
		this.observeObjectProperties(this.filterSettings, cb);
		this.observeObjectProperties(this.filterSettings.languages, cb);
		// this.subscription = this.bindingEngine.propertyObserver(this.filterSettings, 'article').subscribe(this.filterSettingsChanged.bind(this));
	}

	observeObjectProperties(obj, callback) {
		for(let key of Object.keys(obj)) {
			let subscription = this.bindingEngine.propertyObserver(obj, key).subscribe(callback.bind(obj, key));
			this.subscriptions.push(subscription);
		}
	}

	detached() {
		for(let subscription of this.subscriptions) {
			subscription.dispose();
		}
	}

	async selectStory(story) {
		// change representing route
		// this.router.navigateToRoute('query-stories-id', { queryID: this.query.id, storyID: story.id }, { trigger: false });

		this.selectedStory = story;
		// NOTE: scroll into screen not needed if above is uncommented (no way to select specific story by URL
		this.services.story = this.selectedStory;
	}
	async viewStory(story, event) {
		// current route name: this.routeConfig.name
		const route = 'story';
		const params = {
			queryID: this.query.id,
			storyID: story.id
		};

		if(this.services.altTouch || event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) {
			// use any modifier as and excuse to open in separate tab/window
			const url = this.router.generate(route, params);
			window.open(url, '_blank');
		} else {
			this.router.navigateToRoute(route, params, { trigger: true });
		}
	}

	async newQuery() {
		let query = await this.services.newQuery();
		if(query) {
			this.router.navigateToRoute('query-trending-id', { queryID: query.id }, { trigger: true });	// to query trending view
			// this.router.navigateToRoute('stories', { queryID: query.id }, { trigger: true }); // to stories view
		}
	}

	async sortByChanged() {
		this.filter();
	}

	filterSettingsChanged() {
		this.filter();
	}

	async filter() {
		console.log('filtering');
		let settings = this.filterSettings;
		let stories = this.stories;
		let allStories = this.query.stories;
		// let latest = settings.latest * 60 * 1000; // milliseconds
		let now = moment();
		let filtered = allStories.filter(story => {
			let types = story.mediaItemTypes;
			if(settings.latest) {
				if(now.diff(story.latestItemTime, 'minutes') > settings.latest)
					return false;
			}
			let include = false;
			for(let type of Object.keys(types)) {
				if(types[type] > 0) {
					if(settings[type.toLowerCase()])
						include = true;
				}
			}
			if(!include) {
				return false;
			}
			include = false;
			let languages = story.mediaItemLangs;
			for(let language of Object.keys(languages)) {
				if(languages[language] > 0) {
					if(settings.languages[language])
						include = true;
				}
			}
			return include
		});
		// Array.prototype.splice.apply(stories, [0, stories.length].concat(filtered));
		stories = filtered;
		// console.log(stories);
		let sortFn;
		if(this.sortBy == 'most') {
			sortFn = (a, b) => b.itemCount - a.itemCount;
		} else if(this.sortBy == 'least') {
			sortFn = (a, b) => a.itemCount - b.itemCount;
		} else if(this.sortBy == 'newest') {
			sortFn = (a, b) => b.latestItemTime.diff(a.latestItemTime);
		} else if(this.sortBy == 'oldest') {
			sortFn = (a, b) => a.latestItemTime.diff(b.latestItemTime);
		}
		stories.sort(sortFn);
		this.stories = stories;
	}
}
