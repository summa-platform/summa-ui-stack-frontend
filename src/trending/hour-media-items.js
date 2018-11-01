import {inject, bindable, observable} from 'aurelia-framework';
import {Router, Redirect} from 'aurelia-router';
import log from 'logger';
import {Store} from 'store';
import {Services} from 'services';


@inject(Store, Router, Services)
export class HourMediaItems {

	selectedMediaItem;

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
		if(this.services.feed) {
			this.feed = this.services.feed;
		}
		if(this.params.feedID) {
			// if(this.store.feeds && this.store.feeds.length > 0) {
			// 	this.feeds = this.store.feeds;
			// } else {
			// 	this.store.getFeeds().then(feeds => this.feeds = feeds);
			// }
			this.store.getFeed(this.params.feedID).then(feed => { this.feed = feed; this.services.feed = feed; this.setTitle(); });
		}

		// only needed to set query name in path bar
		// this.store.getQueryStories(this.params.queryID).then(query => { this.query = query; this.services.query = query; });
		if(this.params.queryID && this.params.queryID !== 'all')
		this.store.getQuery(this.params.queryID).then(query => { this.query = query; this.services.query = query; this.setTitle(); });
		// this.store.getQueryStories(this.params.queryID).then(query => { this.query = query; this.services.query = query; });

		if(this.params.queryID)
		this.allMediaItems = this.mediaItems = await this.store.getQueryHourlyMediaItems(this.params.queryID, this.params.pastHour, this.params.entity);
		else if(this.params.feedID)
		this.allMediaItems = this.mediaItems = await this.store.getFeedHourlyMediaItems(this.params.feedID, this.params.pastHour);
		this.pastHour = this.params.pastHour.split('-', 2)[1];

		// total confidence = (confidence1 + confidence2 + ...) / N
		let allTopics = {};
		for(const mediaItem of this.mediaItems) {
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
		

		// this.storyPromise = this.store.getQueryStory(this.params.queryID, this.params.storyID).then(story => {
		// 	this.story = story; this.services.story = story; });

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

	setTitle() {
		if(this.params.queryID) {
			let queryName = this.query ? this.query.name : 'All';
			// this.title = `Media Items of Query: ${queryName} and Entity: ${this.params.entity} for past hour: -${this.pastHour}`;
			// this.title = `Media Items of Query: ${queryName} and Entity: ${this.params.entity} at -${this.pastHour}h`;
			// this.title = `Media Items of Entity "${this.params.entity}" and Query "${queryName}" from ${this.pastHour}h ago`;
			this.title = `Media Items with Entity "${this.params.entity}" of Query "${queryName}" from ${this.pastHour}h ago`;
		} else if(this.feed) {
			this.title = `Media Items from Feed "${this.feed.name}" from ${this.pastHour}h ago`;
		}
	}

	attached() {
		this.setTitle();

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

	async selectMediaItem(mediaItem) {
		// change representing route
		// this.router.navigateToRoute('story-media-item-id', { queryID: this.query.id, storyID: story.id, mediaItemID: mediaItem.id }, { trigger: false });

		this.selectedMediaItem = mediaItem;
		// NOTE: scroll into screen not needed if above is uncommented (no way to select specific story by URL
		this.services.mediaItem = this.selectedMediaItem;
	}

	async viewMediaItem(mediaItem, event) {
		// current route name: this.routeConfig.name
		let route;
		const params = {
			pastHour: this.params.pastHour,
			mediaItemID: mediaItem.id
		};
		if(this.params.queryID) {
			params.queryID = this.params.queryID;
			params.entity = this.params.entity;
			route = 'hour-media-item';
		} else if(this.params.feedID) {
			params.feedID = this.params.feedID;
			route = 'feed-hour-media-item';
		}

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
