import {singleton, inject, NewInstance, bindable} from 'aurelia-framework';
import {HttpClient, json} from 'aurelia-fetch-client';
import log from 'logger';
import moment from 'moment';
import {NotificationService} from 'aurelia-notify';
import 'url-search-params-polyfill';

// https://stackoverflow.com/a/32749533
class ExtendableError extends Error {
	constructor(message) {
		super(message);
		this.name = this.constructor.name;
		if (typeof Error.captureStackTrace === 'function') {
			Error.captureStackTrace(this, this.constructor);
		} else {
			this.stack = (new Error(message)).stack;
		}
	}
}
class ServerError extends ExtendableError {
	constructor(message, response, body) {
		super(message);
		this.response = response;
		this.body = body;
	}
}

const configPath = 'config.json';

function updateItem(array, updatedItem, unshift, merge) {
	if(typeof updatedItem === 'string') {
		// just append
		if(unshift) {
			array.unshift(updatedItem);
		} else {
			array.push(updatedItem);
		}
		return updatedItem;
	}
	let index = array.findIndex((item, index, array) => {
		return item.id === updatedItem.id;
	});
	if(index != -1) {
		if(merge) {
			// first remove all enumerable keys before merge
			// let item = array[index];
			// for(let key in item) {
			// 	console.log('key:', key)
			// 	if(item.hasOwnProperty(key)) {
			// 		delete item[key];
			// 	}
			// }
			return Object.assign(array[index], updatedItem);
		} else {
			array.splice(index, 1, updatedItem);	// [...] = assign won't be observed by aurelia
		}
	} else {
		if(unshift) {
			array.unshift(updatedItem);
		} else {
			array.push(updatedItem);
		}
	}
	return updatedItem;
}

function updateArrayItem(array, updatedItem, unshift, merge) {
	return updateItem(array, updatedItem, unshift, merge);
}

function removeArrayItem(array, itemOrId) {
	let id = typeof itemOrId === 'object' ? itemOrId.id : itemOrId;
	let index = array.findIndex((item, index, array) => {
		return item.id === id;
	});
	if(index != -1) {
		array.splice(index, 1);
	}
}

function replaceArrayItems(array, items) {
	if(array === undefined) {
		return items;
	}
	Array.prototype.splice.apply(array, [0, array.length].concat(items));
	return array;
}

function assignKeys(target, source, ...keys) {
	for(let key of keys) {
		target[key] = source[key];
	}
	return target;
}

function assignExceptKeys(target, source, ...excludeKeys) {
	let keys = {};
	for(let key of excludeKeys) {
		keys[key] = true;
	}
	for(let key in source) {
		if(source.hasOwnProperty(key)) {
			if(!keys[key]) {
				target[key] = source[key];
			}
		}
	}
	return target;
}

function filterObject(object, ...allowdKeys) {
	let keys = {};
	for(let key of allowedKeys) {
		keys[key] = true;
	}
	for(let key in object) {
		if(!keys[key] && object.hasOwnProperty(key)) {
			delete object[key];
		}
	}
	return object;
}


// @singleton(true)
@inject(NewInstance.of(HttpClient), NewInstance.of(HttpClient), NotificationService)
export class Store {
	isRequesting = 0;
	feedTypes = [];
	feedGroups = [];
	feeds = [];
	queries = [];
	stories = [];
	newsItems = [];
	users = [];
	feedback = [];
	feedbackRatingTypes = [];
	currentUser = { };
	namedEntities = [];
	bookmarks = [];
	currentUser = {};
	// currentUser = { id: '4996bc6b-32df-43ed-9d40-062ccf5c137e' };
	feedbackStatuses = [
		{ value: undefined, label: 'Unresolved', hidden: true },
		{ value: null, label: 'Unresolved' },
		{ value: 'resolved', label: 'Resolved' },
	];
	currentView = 'login';

	constructor(newAPI, http, notificationService) {
		this.http = http.configure(c => c);
		this.notificationService = notificationService;
		this.configPromise = this.http.fetch(configPath).then(response => response.json()).then(config => {
			this.newAPI = newAPI.configure(c => c
					.withBaseUrl(config.api)
					.withDefaults({
					// 	credentials: 'same-origin',
						headers: {
							'pragma': 'no-cache',
							'cache-control': 'no-cache',
					// 		'Accept': 'application/json',
					// 		'X-Requested-With': 'Fetch'
						}
					})
					.withInterceptor({
						request(request) {
							log.debug(`Requesting ${request.method} ${request.url}`);
							return request;
						},
						response(response) {
							if((response.status < 200 || response.status >= 300) && response.status != 401) {
								notificationService.danger(`API Error`);
							}
							log.debug(`Received ${response.status} ${response.url}`);
							return response;
						}
					})
			);
		});
	}

	reset() {
		function removeAll(array) {
			array.splice(0, array.length);
		}
		removeAll(this.feedTypes);
		removeAll(this.feedGroups);
		removeAll(this.feeds);
		removeAll(this.queries);
		removeAll(this.stories);
		removeAll(this.newsItems);
		removeAll(this.users);
		removeAll(this.feedback);
		removeAll(this.feedbackRatingTypes);
	}
	
	// --- general ---

	async fetch(url, method, body, opts) {
		if(!this.newAPI) {
			await this.configPromise;
		}
		// autodetect method if not specified
		if(method === undefined) {
			if(body === undefined) {
				method = 'GET';
			} else if(typeof method === 'object') {
				if(body.id === undefined) {
					method = 'POST';
				} else {
					method = 'PATCH'
				}
			// } else if(typeof method === 'string') {
			// 	method = 'POST';
			}
		}
		method = method.toUpperCase();
		if(!this.authHeader) {
			if(this.token) {
				this.authHeader = 'Bearer ' + this.token;
			} else {
				this.authHeader = '';
			}
		}
		let options = { method: method, headers: {'Authorization': this.authHeader} };
		if(opts) {
			for(let key in opts) {
				if(key == 'headers') {
					if(opts[key] instanceof Headers) {
						let hdrs = options.headers;
						options.headers = opts[key];
						for(let hdr in hdrs) {
							options.headers.append(hdr, hdrs[hdr]);
						}
					} else {
						let hdrs = opts[key];
						for(let hdr in hdrs) {
							options.headers[hdr] = hdrs[hdr];
						}
					}
				} else if (key != method) {
					options[key] = opts[key];
				}
			}
		}
		if(body) {
			if(typeof URLSearchParams === 'object' && body instanceof URLSearchParams) {
				options.body = body;
			} else if(typeof body === 'object') {
				options.body = json(body);
			} else {
				options.body = body;
			}
		}
		this.isRequesting++;
		let response = await this.newAPI.fetch(url, options);
		if(response.status == 401) {
			// unauthorized
			if(url != 'auth/token' && url != 'users/checkPassword') {
				// filter out few paths that are allowed to be unauthorized without action
				//
				// check token
				// await this.getToken();
				// TODO: at this point authentication state should be probably verified and dropped out to login page
				// probably: check if at login page, if not -
				if(this.currentView != 'login')
				location.reload(true);	// force page reload
			}
		}
		let contentType = response.headers.get('Content-Type');
		let authHeader = response.headers.get('Authorization');
		if(authHeader) {
			this.authHeader = authHeader;	// update auth header
			this.token = authHeader.split(' ', 2)[1];
			localStorage['token'] = this.token;	// store new token
		}
		// this.authHeader = response.headers.get('Authorization') || this.authHeader;	// update Authorization header with each call
		let isJSON = contentType && contentType.indexOf('application/json') === 0;
		if(response.status < 200 || response.status >= 300) {
			if(isJSON) {
				body = JSON.stringify(await response.json(),null,4);
			} else {
				body = await response.text();
			}
			this.isRequesting--;
			// log.error(`${method} ${response.url} ${response.status}: ${body}`);
			throw new ServerError(`${method} ${response.url} ${response.status}: ${body}`, response, body);
		}
		this.isRequesting--;
		return response;
		// if(isJSON) {
		// 	return await response.json();
		// }
		// return await response.text();
	}

	async body(response) {
		if(response instanceof Promise) {
			response = await response;
		}
		let contentType = response.headers.get('Content-Type');
		if(contentType && contentType.indexOf('application/json') === 0) {
			return await response.json();
		}
		return await response.text();

	}

	debug(body, response, enabled) {
		if(!enabled) {
			return body;
		}
		let pretty = typeof body === 'object' ? JSON.stringify(body,null,4) : body;
		if(response) {
			let contentType = response.headers.get('Content-Type');
			log.debug(`${response.url} ${response.status} response (${contentType}): ${pretty}`);
		} else {
			log.debug(`Response: ${pretty}`);
		}
		return body;
	}

	async json(response, force, enabled) {
		if(response instanceof Promise) {
			response = await response;
		}
		let contentType = response.headers.get('Content-Type');
		if(contentType && contentType.indexOf('application/json') !== 0) {
			if(force) {
				// return JSON.parse(await response.text());
				return this.debug(JSON.parse(await response.text()), response, enabled);
			}
			let body = await response.text();
			throw new ServerError(`${response.url} ${response.status}: expected JSON response, got (${contentType}): ${body}`, response, body);
		}
		// return await response.json();
		let body = await response.json();
		return this.debug(body, response, enabled);
	}

	async text(response) {
		if(response instanceof Promise) {
			response = await response;
		}
		return await response.text();
	}

	async get(url, params) {
		if(params) {
			let queryParams = new URLSearchParams();
			for(let key of Object.keys(params)) {
				queryParams.set(key, params[key]);
			}
			url += '?'+queryParams.toString();
		}
		return this.fetch(url);
	}

	urlWithParams(url, params) {
		if(params) {
			let queryParams = new URLSearchParams();
			for(let key of Object.keys(params)) {
				queryParams.set(key, params[key]);
			}
			url += '?'+queryParams.toString();
		}
		return url;
	}

	async post(url, body) {
		return this.fetch(url, 'POST', body);
	}

	async patch(url, body) {
		return this.fetch(url, 'PATCH', body);
	}

	async update(url, body) {
		return this.fetch(url, 'PATCH', body);
	}

	async remove(url) {
		return this.fetch(url, 'DELETE');
	}

	// --- ensure current user is loaded ---
	
	async getToken() {
		let token = localStorage['token'];
		try {
			let response = await this.fetch(`auth/token`, 'GET', undefined, { credentials: 'include' });
			token = await response.text();
			localStorage['token'] = token;
		} catch(e) {
		}
		// if(response.status == 200) {
		// }
		console.log('AUTH TOKEN:', token);
		this.authHeader = undefined;
		this.token = token;
	}

	async logout() {
		console.log('LOGGING out');
		await this.fetch(`logout`, 'GET', undefined, { credentials: 'include' });	// to remove auth cookie
		localStorage['token'] = undefined;	// NOTE: already done in auth service logout
		// remove in-memory auth token
		this.token = undefined;
		this.authHeader = undefined;
		// location.href = '/logout';
		location.reload(true);	// force page reload
	}

	async ensureCurrentUser() {
		if(!this.token) {
			this.token = localStorage['token'];
		}
		if(!this.currentUser.id && this.currentUserPromise) {
			await this.currentUserPromise;
		}
		return
	}
	
	// --- named entities ---
	
	async getNamedEntities() {
		this.namedEntities = (await this.json(this.get(`namedEntities`))).entities;
		return this.namedEntities;
		// return replaceArrayItems(this.namedEntities, (await this.json(this.get(`namedEntities`))).entities);
	}

	async getNamedEntityDetails(id) {
		const entityDetails = (await this.json(this.get(`namedEntities/${id}`)));
		for(const mediaItem of entityDetails.mentions) {
			mediaItem.timeAdded = moment(mediaItem.timeAdded);
		}
		return entityDetails;
	}

	// --- users ---
	
	async checkPassword(email, password) {
		// return await this.json(this.post(`users/checkPassword`, { email: email, password: password }));
		let user = await this.json(this.post(`users/checkPassword`, { email: email, password: password }));
		if(user.token) {
			// this.token = user.token;
			// this.authHeader = 'Bearer ' + this.token;
			delete user.token;
		}
		return user;
	}
	
	async getUserRoleTypes() {
		return this.userRoleTypes = await this.json(this.get(`users/roleTypes`));
	}

	async getUsers() {
		let users = await this.json(this.get(`users`))
		for(let user of users) {
			if(!user.data) {
				user.data = {};
			}
		}
		return replaceArrayItems(this.users, users);
	}

	async getUser(id) {
		let user = await this.json(this.get(`users/${id}`));
		if(!user.data) {
			user.data = {};
		}
		return user;
	};

	async removeUser(id) {
		let result = await this.body(this.remove(`users/${id}`));
		removeArrayItem(this.users, id);
		return id;
	};

	async addUser(user) {
		user = assignKeys({}, user, 'name', 'email', 'password', 'role', 'isSuspended', 'data');
		if(user.isSuspended === undefined) {
			user.isSuspended = false;
		}
		user = await this.json(this.post(`users`, user));
		updateArrayItem(this.users, user);
		return user;
	}

	async updateUser(user) {
		let id = user.id;
		let incomingUser = user;
		user = assignKeys({}, user, 'name', 'email', 'role', 'isSuspended', 'password', 'currentPassword', 'data');
		// if(user.isSuspended === undefined) {
		// 	user.isSuspended = false;
		// }
		// if(user.password && user.password == user.confirmPassword) {
		// 	// if(!user.currentPassword) {
		// 	// 	throw Error('currentPassword must be present to change password');
		// 	// }
		// }
		user = assignExceptKeys({}, user, 'id');	// or assignKeys({}, user, ...keys to include)
		user = await this.json(this.patch(`users/${id}`, user));
		updateArrayItem(this.users, user);
		return user;
	}

	async saveUser(user) {
		if(user.id) {
			return this.updateUser(user);
		}
		return this.addUser(user);
	}

	// --- feeds ---
	
	async getFeedTypes() {
		return this.feedTypes = replaceArrayItems(this.feedTypes, await this.json(this.get(`feeds/feedTypes`)));
	}
	
	async getFeeds() {
		return this.feeds = replaceArrayItems(this.feeds, await this.json(this.get(`feeds`)));
	};

	async getFeed(id) {
		return await this.json(this.get(`feeds/${id}`));
	};

	async removeFeed(id) {
		let result = await this.body(this.remove(`feeds/${id}`));
		removeArrayItem(this.feeds, id);
		return id;
	};

	async addFeed(feed) {
		delete feed.feedGroups;
		feed = await this.json(this.post(`feeds`, feed));
		updateArrayItem(this.feeds, feed);
		return feed;
	}

	async updateFeed(feed) {
		// delete feed.feedGroups;
		if(!feed.feedGroups) {
			feed.feedGroups = [];
		} else {
			feed.feedGroups = feed.feedGroups.map(group => typeof group === 'object' ? group.id : group);
		}
		let id = feed.id;
		feed = assignExceptKeys({}, feed, 'id', 'status');	// or assignKeys({}, feed, ...keys to include)
		feed = await this.json(this.patch(`feeds/${id}`, feed));
		updateArrayItem(this.feeds, feed);
		return feed;
	}

	async saveFeed(feed) {
		if(feed.id) {
			return this.updateFeed(feed);
		}
		return this.addFeed(feed);
	}

	async getFeedTrending(id) {
		return await this.json(this.get(`feeds/${id}/trending`));
	}

	async getFeedHourlyMediaItems(id, pastHour) {
		pastHour = pastHour.split('-', 2);
		const params = { epochTimeSecs: pastHour[0], pastHourString: -parseInt(pastHour[1]) || '-0' };
		if(!id)
			id = 'all';
		let mediaItems = (await this.json(this.get(`feeds/${id}/trending/mediaItemSelection`, params))).mediaItems;
		for(const mediaItem of mediaItems) {
			mediaItem.timeAdded = moment(mediaItem.timeAdded);
		}
		return mediaItems;
	}

	async getLiveFeedsData(datetime) {
		let params = {};
		if(!datetime) {
			datetime = 'now';
		}
		if(datetime) {
			params.dt = datetime;
		}
		params.margin = '12h';
		let feeds = await this.json(this.get(`feeds/live/items`, params));
		for(const feed of feeds) {
			for(const item of feed.newsItems) {
				item.timeAdded = moment(item.timeAdded);
			}
		}
		return feeds;
	}

	// --- feed groups ---

	async getFeedGroups(global) {
		if(global)
			return this.feedGroups = replaceArrayItems(this.feedGroups, await this.json(this.get(`feedGroups`)));
		else
			return await this.json(this.get(`feedGroups`));
	};

	async getFeedGroup(id) {
		return await this.json(this.get(`feedGroups/${id}`));
	}

	async removeFeedGroup(id) {
		let result = await this.body(this.remove(`feedGroups/${id}`));
		removeArrayItem(this.feedGroups, id);
		return id;
	}

	async addFeedGroup(feedGroup) {
		feedGroup = assignKeys({}, feedGroup, 'name', 'feeds');
		if(feedGroup.feeds === undefined) {
			feedGroup.feeds = [];
		} else {
			feedGroup.feeds = feedGroup.feeds.map(feed => typeof feed !== 'string' ? feed.id : feed);
		}
		feedGroup = await this.json(this.post(`feedGroups`, feedGroup));
		updateArrayItem(this.feedGroups, feedGroup);
		return feedGroup;
	}

	async updateFeedGroup(feedGroup) {
		let id = feedGroup.id;
		if(feedGroup.feeds) {
			feedGroup.feeds = feedGroup.feeds.map(feed => typeof feed !== 'string' ? feed.id : feed);
		}
		feedGroup = assignExceptKeys({}, feedGroup, 'id');	// or assignKeys({}, feedGroup, ...keys to include)
		feedGroup = await this.json(this.patch(`feedGroups/${id}`, feedGroup));
		updateArrayItem(this.feedGroups, feedGroup);
		return feedGroup;
	}

	async saveFeedGroup(feedGroup) {
		if(feedGroup.id) {
			return this.updateFeedGroup(feedGroup);
		}
		return this.addFeedGroup(feedGroup);
	}
	
	// --- queries ---

	async getAllQueries() {
		return this.queries = replaceArrayItems(this.queries, await this.json(this.get(`queries`)));
	};

	async getQueries(id) {
		await this.ensureCurrentUser();
		if(id === undefined) {
			id = this.currentUser.id;
		}
		this.queries = replaceArrayItems(this.queries, await this.json(this.get(`users/${id}/queries`)));
		for(let query of this.queries) {
			for(let i in query.feedGroups) {
				let feedGroup = query.feedGroups[i];
				if(typeof feedGroup != 'string') {
					query.feedGroups[i] = feedGroup.id;
				}
			}
		}
		return this.queries;
	};

	async getQuery(id) {
		// if(id === 'all') {
		// 	return { id: 'all', name: 'All' };
		// }
		if(!id)
			id = 'all';
		await this.ensureCurrentUser();
		let uid = this.currentUser.id;
		// return await this.json(this.get(`users/${uid}/queries/${id}`));
		return await this.json(this.get(`queries/${id}`));
	}

	async getQueryTrending(id) {
		if(!id)
			id = 'all';
		return await this.json(this.get(`queries/${id}/trending`));
	}

	async getQueryStories(id) {
		let query = await this.json(this.get(`queries/${id}/stories`));
		if(id === 'all') {
			if(query instanceof Array) {
				query = { id: 'all', name: 'All', stories: query };
			} else if(!query.id) {
				query.id = 'all';
			}
		}
		for(let story of query.stories) {
			story.latestItemTime = moment(story.latestItemTime);
		}
		return query;
	}

	async getQueryHourlyMediaItems(id, pastHour, entity) {
		pastHour = pastHour.split('-', 2);
		const params = { epochTimeSecs: pastHour[0], pastHourString: -parseInt(pastHour[1]) || '-0', namedEntity: entity };
		if(!id)
			id = 'all';
		let mediaItems = (await this.json(this.get(`queries/${id}/trending/mediaItemSelection`, params))).mediaItems;
		for(const mediaItem of mediaItems) {
			mediaItem.timeAdded = moment(mediaItem.timeAdded);
		}
		return mediaItems;
	}

	async removeQuery(id) {
		let result = await this.body(this.remove(`queries/${id}`));
		removeArrayItem(this.queries, id);
		return id;
	}

	async addQuery(query) {
		// query = assignKeys({}, query, 'name', 'feedGroups', 'user', 'namedEntities', 'namedEntityFilterType');
		// query = assignKeys({}, query, 'name', 'feedGroups', 'user', 'entities', 'from', 'till', 'mediaTypes', 'languages');
		query = Object.assign({}, query);
		if(!query.feedGroups) {
			query.feedGroups = [];
		} else {
			query.feedGroups = query.feedGroups.map(feedGroup => typeof feedGroup === 'object' ? feedGroup.id : feedGroup);
		}
		// if(!query.namedEntityFilterType) {
		// 	query.namedEntityFilterType = "OR";
		// }
		// if(!query.namedEntities) {
		// 	query.namedEntities = []
		// } else {
		// 	query.namedEntities = query.namedEntities.map(entity => typeof entity === 'object' ? entity.baseForm : entity);
		// }
		if(!query.entities) {
			query.entities = []
		} else {
			query.entities = query.entities.map(entity => typeof entity === 'object' ? entity.baseForm : entity);
		}
		if(!query.user) {
			query.user = this.currentUser.id;
		}
		query = await this.json(this.post(`queries`, query));
		updateArrayItem(this.queries, query);
		return query;
	}

	async updateQuery(query) {
		let id = query.id;
		query = assignExceptKeys({}, query, 'id');	// or assignKeys({}, query, ...keys to include)
		if(query.feedGroups) {
			query.feedGroups = query.feedGroups.map(feedGroup => typeof feedGroup === 'object' ? feedGroup.id : feedGroup);
		}
		if(query.namedEntities) {
			query.namedEntities = query.namedEntities.map(entity => typeof entity === 'object' ? entity.baseForm : entity);
		}
		query = await this.json(this.patch(`queries/${id}`, query));
		updateArrayItem(this.queries, query);
		return query;
	}

	async saveQuery(query) {
		if(query.id) {
			return this.updateQuery(query);
		}
		return this.addQuery(query);
	}

	// --- Trending ---
	async getTrending(query) {
		for(let i in query.feedGroups) {
			let feedGroup = query.feedGroups[i];
			if(typeof feedGroup != 'string') {
				query.feedGroups[i] = feedGroup.id;
			}
		}
		let response = await this.json(this.post(`queries/trending`, query));
		return response;
	}

	async getClusters(query, group, count, offset, sort) {
		if(group) {
			group = 'topics';
			count = query.clusters;
		} else {
			group = '';
		}
		if(!sort) {
			sort = query.sortBy;
		}
		let response = await this.json(this.post(this.urlWithParams(`mediaItems/clusters`, { count: count || '', offset: offset || '', group: group, sort: sort || 'size' }), query));
		if(!group) {
			console.log(response)
			for(let cluster of response.clusters) {
				cluster.lastUpdate = moment(cluster.lastUpdate);
			}
		}
		return response;
	}

	async getMediaItems(query) {
		let response = await this.json(this.post(`queries/mediaItems`, query));
		for(let mediaItem of response.mediaItems) {
			mediaItem.timeAdded = moment(mediaItem.timeAdded);
		}
		return response;
	}

	async getEntitiesWithGeolocationInfo(query, type) {
		return await this.json(this.post(`locations` + (type === 'topic' ? '?item=topic' : ''), query));
	}

	// --- stories & media items ---

	async getStory(id) {
		return await this.json(this.get(`stories/${id}`));
	}

	async getQueryStory(qid, id) {
		let story = await this.json(this.get(`queries/${qid}/stories/${id}`));
		story.timeChanged = moment(story.timeChanged);
		for(let mediaItem of story.mediaItems) {
			mediaItem.timeAdded = moment(mediaItem.timeAdded);
		}
		return story;
	}

	async getMediaItem(id) {
		let mediaItem = await this.json(this.get(`mediaItems/${id}`));
		mediaItem.timeAdded = moment(mediaItem.timeAdded);
		mediaItem.timeLastChanged = moment(mediaItem.timeLastChanged);
		return mediaItem;
	}

	async getMediaItemNeighbours(id, count) {
		if(!count) {
			count = 150;
		}
		let mediaItems = await this.json(this.get(`mediaItems/${id}/neighbours`, { count: count }));
		for(let mediaItem of mediaItems) {
			mediaItem.timeAdded = moment(mediaItem.timeAdded);
			// mediaItem.timeLastChanged = moment(mediaItem.timeLastChanged);
		}
		return mediaItems;
	}

	// --- feedback ---

	async getFeedbackRatingTypes(id) {
		return this.feedbackRatingTypes = await this.json(this.get(`feedback/ratingTypes`));
	}

	async getFeedbackItems() {
		const feedback = replaceArrayItems(this.feedback, await this.json(this.get(`feedback`)));
		for(const item of feedback) {
			item.timeAdded = moment(item.timeAdded);
		}
		return this.feedback = feedback;
	};

	async getFeedbackItem(id, updateArray) {
		let item = await this.json(this.get(`feedback/${id}`));
		item.timeAdded = moment(item.timeAdded);
		if(updateArray) {
			return updateArrayItem(this.feedback, item, false, true);
		}
		return item;
	}

	async removeFeedbackItem(id) {
		let result = await this.body(this.remove(`feedback/${id}`));
		removeArrayItem(this.feedback, id);
		return id;
	}

	async addFeedbackItem(feedback) {
		// feedback = assignKeys({}, feedback, 'name', 'feedGroups', 'user', 'namedEntities', 'namedEntityFilterType');
		let userName = feedback.userName;
		delete feedback.userName;
		let result = await this.json(this.post(`feedback`, feedback));
		feedback = Object.assign(feedback, result, { user: { name: userName, id: feedback.user }});
		feedback.timeAdded = moment(feedback.timeAdded);
		return updateArrayItem(this.feedback, feedback, true);
	}

	async updateFeedbackItem(feedback) {
		let id = feedback.id;
		feedback = assignExceptKeys({}, feedback, 'id', 'timeAdded');	// or assignKeys({}, query, ...keys to include)
		if(typeof feedback.user === 'object') {
			feedback.user = feedback.user.id;
		}
		feedback = await this.json(this.patch(`feedback/${id}`, feedback));
		feedback.timeAdded = moment(feedback.timeAdded);
		return updateArrayItem(this.feedback, feedback, false, true);
	}

	async saveFeedbackItem(feedback) {
		if(feedback.id) {
			return this.updateFeedbackItem(feedback);
		}
		return this.addFeedbackItem(feedback);
	}

	getFeedbackStatuses() {
		return this.feedbackStatuses;
	}

	// --- bookmarks ---

	async getBookmarkTypes() {
		// return this.bookmarkTypes = replaceArrayItems(this.bookmarkTypes, await this.json(this.get(`bookmarks/types`)));
		return {
			'media-item': 'Media-Item'
		};
	}

	sortBookmarks(bookmarks) {
		if(!bookmarks)
			bookmarks = this.bookmarks;
		let sortFn;
		// newest
		sortFn = (a, b) => b.timeAdded.diff(a.timeAdded);
		// oldest
		// sortFn = (a, b) => a.timeAdded.diff(b.timeAdded);
		bookmarks.sort(sortFn);
		return bookmarks;
	}

	async getBookmarks() {
		await this.ensureCurrentUser();
		let uid = this.currentUser.id;
		let bookmarks = this.bookmarks = replaceArrayItems(this.bookmarks, await this.json(this.get(`users/${uid}/bookmarks`)));
		for(let bookmark of bookmarks) {
			bookmark.timeAdded = moment(bookmark.timeAdded);
		}
		this.sortBookmarks(bookmarks);
		return bookmarks;
	};

	async getBookmark(id) {
		await this.ensureCurrentUser();
		let uid = this.currentUser.id;
		let bookmark = await this.json(this.get(`users/${uid}/bookmarks/${id}`));
		bookmark.timeAdded = moment(bookmark.timeAdded);
		return bookmark;
	};

	async removeBookmark(id) {
		await this.ensureCurrentUser();
		let uid = this.currentUser.id;
		let result = await this.body(this.remove(`users/${uid}/bookmarks/${id}`));
		removeArrayItem(this.bookmarks, id);
		return id;
	};

	async addBookmark(bookmark) {
		await this.ensureCurrentUser();
		let uid = this.currentUser.id;
		bookmark = await this.json(this.post(`users/${uid}/bookmarks`, bookmark));
		bookmark.timeAdded = moment(bookmark.timeAdded);
		updateArrayItem(this.bookmarks, bookmark);
		this.sortBookmarks(bookmarks);
		return bookmark;
	}

	async updateBookmark(bookmark) {
		await this.ensureCurrentUser();
		let uid = this.currentUser.id;
		let id = bookmark.id;
		// bookmark = assignExceptKeys({}, bookmark, 'id', 'status');	// or assignKeys({}, bookmark, ...keys to include)
		bookmark = await this.json(this.patch(`users/${uid}/bookmarks/${id}`, bookmark));
		bookmark.timeAdded = moment(bookmark.timeAdded);
		updateArrayItem(this.bookmarks, bookmark);
		return bookmark;
	}

	async saveBookmark(bookmark) {
		if(bookmark.id) {
			return this.updateBookmark(bookmark);
		}
		return this.addBookmark(bookmark);
	}
}
