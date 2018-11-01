import {inject, bindable, observable} from 'aurelia-framework';
import {Router, Redirect} from 'aurelia-router';
import log from 'logger';
import {Store} from 'store';
import {Services} from 'services';


@inject(Store, Router, Services)
export class Story {

	selectedMediaItem;
	mediaItems = [];

	constructor(store, router, services) {
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
		if(this.services.story) {
			this.story = this.services.story;
		}

		// only needed to set query name in path bar
		// this.store.getQueryStories(this.params.queryID).then(query => { this.query = query; this.services.query = query; });
		this.store.getQuery(this.params.queryID).then(query => { this.query = query; this.services.query = query; });

		// this.storyPromise = this.store.getStory(this.params.storyID).then(story => { this.story = story; this.services.story = story; });
		this.storyPromise = this.store.getQueryStory(this.params.queryID, this.params.storyID).then(story => {
			this.story = story; this.services.story = story; });

		this.storyPromise.then(() => {
			this.allMediaItems = this.mediaItems = this.story.mediaItems;
			// console.log(this.mediaItems)
			// console.log(this)
			// total confidence = (confidence1 + confidence2 + ...) / N
			let allTopics = {};
			for(const mediaItem of this.mediaItems) {
				// topics
				let detectedTopics = {};
				for(const [topic, confidence] of mediaItem.detectedTopics) {
					// console.log(topic, confidence);
					// detectedTopics[topic] = confidence;
					detectedTopics[topic] = true;
					if(!allTopics[topic]) {
						allTopics[topic] = { count: 1, confidence, label: topic };
					} else {
						allTopics[topic].count += 1;
						allTopics[topic].confidence += confidence;
					}
				}
				mediaItem.detectedTopicsPresent = detectedTopics;
			}
			let allTopicsArray = [];
			for(let topic of Object.keys(allTopics)) {
				topic = allTopics[topic];
				topic.confidence /= topic.count;
				// allTopicsArray.push([ topic.name, topic.confidence, topic.count, selected: false ]);
				topic.selected = false;
				allTopicsArray.push(topic);
			}
			// this.allTopics = allTopicsArray.sort((a, b) => b[1] - a[1]);
			// this.allTopics = allTopicsArray.sort((a, b) => b.confidence - a.confidence);
			this.allTopics = allTopicsArray.sort((a, b) => (b.count - a.count) || (b.confidence - a.confidence));	// first by count, then by confidence
		});

		// moved from to attached() because at this point the current route is not yet set up properly
		// if(this.params.mediaItemID) {
		// 	let mediaItemID = this.params.mediaItemID;
		// 	this.storyPromise.then(query => {
		// 		let mediaItem = story.mediaItems.find(mediaItem => mediaItem.id === mediaItemID);
		// 		if(mediaItem) {
		// 			this.selectMediaItem(mediaItem);
		// 		}
		// 	});
		// }
	}

	attached() {
		// Select specified by URL:
		// moved from activate() because route was not correctly set up, so navigate does not work correctly from activate
		// if(this.params.mediaItemID) {
		// 	let mediaItemID = this.params.mediaItemID;
		// 	this.storyPromise.then(query => {
		// 		let mediaItem = story.mediaItems.find(mediaItem => mediaItem.id === mediaItemID);
		// 		if(mediaItem) {
		// 			this.selectMediaItem(mediaItem);
		// 		}
		// 	});
		// }
	}

	toggleTopic(topic) {
		topic.selected = !topic.selected;
		// TODO: filter by topics
		this.filterMediaItems();
	}

	filterMediaItems() {
		const selectedTopics = [];
		for(const topic of this.allTopics) {
			if(topic.selected)
				selectedTopics.push(topic.label);
		}
		if(selectedTopics.length === 0) {
			this.mediaItems = this.allMediaItems;
			this.selectedCount = undefined;
			return;
		}
		this.mediaItems = this.allMediaItems.filter(mediaItem => {
			for(const topic of selectedTopics) {
				if(mediaItem.detectedTopicsPresent[topic])
					return true;
			}
			return false;
		});
		this.selectedCount = this.mediaItems.length;
	}

	async selectMediaItem(mediaItem) {
		// change representing route
		// this.router.navigateToRoute('story-media-item-id', { queryID: this.query.id, storyID: story.id, mediaItemID: mediaItem.id }, { trigger: false });

		this.selectedMediaItem = mediaItem;
		// NOTE: scroll into screen not needed if above is uncommented (no way to select specific story by URL
		this.services.mediaItem = this.selectedMediaItem;
	}

	async viewMediaItem(mediaItem, event) {
		// current route name: this.routeConfig.name
		const route = 'story-media-item';
		const params = {
			queryID: this.params.queryID,
			storyID: this.story.id,
			mediaItemID: mediaItem.id
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
}
