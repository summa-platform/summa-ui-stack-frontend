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

		this.queryPromise = this.store.getQueryStories(this.params.queryID).then(query => { this.query = query; this.services.query = query; });
		this.queryPromise.then(() => {
			this.filter();
		});
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
			// use any modifier as an excuse to open in separate tab/window
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
		}
	}

	async sortByChanged() {
		this.filter();
	}

	filterSettingsChanged() {
		this.filter();
	}

	async filter() {
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
