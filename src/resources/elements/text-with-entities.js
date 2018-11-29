import {inject, bindable, observable, bindingMode, children} from 'aurelia-framework';
import log from 'logger';
import colors from 'material-color';


function hashCode(string) {
	let hash = 0;
	let i;
	let chr;
	let len;
	if (string.length === 0) return hash;
	for (i = 0, len = string.length; i < len; i += 1) {
		chr = string.charCodeAt(i);
		hash = ((hash << 5) - hash) + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return (hash < 0 ? -hash : hash);
}

// workaround for incorrect mention position bug
// searches for text match in near range
function getMentionStart(text, mention, maxOffset) {
	let offset = maxOffset || 10;
	const start = Math.max(0, mention.startPosition - offset);
	offset = text.substr(start, mention.endPosition + offset).indexOf(mention.text);
	if (offset === -1) {
		return mention.startPosition;
	}
	return start + offset;
}

// this function will convert from Priberam entities with mentions in text
// to spans with entity annotations
// should be able to handle overlapping entity mentions, however not tested
function entitiesToSpanItems(mentions, text, entities) {
	// console.warn('entitiesToSpanItems', entities, text);
	if(!mentions) {
		if(!text) {
			return [];
		}
		return [{
			start: 0,
			end: text.length,
			text: text,
			// entities: []
		}];
	}
	const entitySpans = [];
	// extract entity spans
	for(const name of Object.keys(mentions)) {
		const entity = entities ? entities[name] : { baseForm: name };
		for(const mention of mentions[name]) {
			const start = text ? getMentionStart(text, mention) : mention.startPosition; // workaround
			// const start = mention.startPosition; // when position bug gets fixed
			entitySpans.push({
			entity: entity,
			// text: text ? text.substring(start, start + (mention.endPosition - mention.startPosition)) : mention.text,
			text: mention.text,	// will be used only when text is not available
			start,
			end: start + (mention.endPosition - mention.startPosition),
			});
		}
	}
	// sort entity spans by start and end
	entitySpans.sort((a, b) => {
		if (a.start < b.start) {
			return -1;
		} else if (a.start > b.start) {
			return 1;
		} else if (a.end < b.end) {
			return -1;
		} else if (a.end > b.end) {
			return 1;
		}
		return 0;
	});
	// join entity spans and break into atomic unit spans
	const unitSpans = [];
	let unitSpan;
	let j;
	let start;
	let end;
	let last;
	let first;
	let entitySpan;
	first = 0;
	while (first < entitySpans.length) {
		// first = i;
		start = entitySpans[first].start;
		// find sibling spans with the same start position
		for (j = first + 1; j < entitySpans.length; j += 1) {
			// because list is sorted, break if start position advances
			if (entitySpans[j].start > start) {
				break;
			}
		}
		last = j;
		// find atomic unit span end position
		end = entitySpans[first].end;  // start with intial value
		for (j = first; j < last; j += 1) {
			if (entitySpans[j].end < end) {
				end = entitySpans[j].end;
			}
		}
		// if first non-sibling span start is less than end, set end to the start of this span
		// (next non-sibling span start can be only greater or equal because the list is sorted)
		if (last < entitySpans.length && entitySpans[last].start < end) {
			end = entitySpans[last].start;
		}
		// new unit span produced by this cycle
		unitSpan = { entities: [], start, end,
			text: text ? text.substring(start, end) : entitySpans[first].text.substring(0, end-start) };
		// create new atomic unit span and modify start positions of not fully consumed spans
		for (j = first; j < last; j += 1) {
			unitSpan.entities.push(entitySpans[j].entity);		// update entity list of the new unit span
			if (entitySpans[j].end === end) {
				// fully consumed
				// advance the start index of next cycle to next span
				first = j + 1;		// given that the list is sorted by both start and end
			} else {
				// partially consumed
				entitySpan = entitySpans[j];
				if(entitySpan.text) {
					entitySpan.text = entitySpan.text.substring(end - entitySpan.start, entitySpan.end - end);
				}
				entitySpan.start = end; // make rest of existing span as a new span
			}
		}
		// store the newly produced unit span
		unitSpans.push(unitSpan);
	}
	for (unitSpan of unitSpans) {
		let spanType = '';
		const entities = [];
		for(const entity of unitSpan.entities) {
			entities.push(`${entity.baseForm} (${entity.type})`);
			if(!spanType) {
				spanType = entity.type;
			}
		}
		unitSpan.title = entities.join(', ');
		unitSpan.color = hashCode(spanType+'#'+spanType);	// increase hash performance
        // unitSpan.wiki = entities[0].id || entities[0].baseform; // TODO: overlapping entities ?
	}
	if(!text) {
		// no text, return unit spans only
		return unitSpans;
	}
	// build result span list
	const spans = [];
	last = 0;
	for (unitSpan of unitSpans) {
		// insert text span before enity span if required
		if (unitSpan.start > last) {
			spans.push({
				start: last,
				end: unitSpan.start,
				text: text.substring(last, unitSpan.start),
				// entities: []
			});
		}
		spans.push(unitSpan);
		last = unitSpan.end;
	}
	// insert final text span if required
	if (last < text.length) {
		spans.push({
			start: last,
			end: text.length,
			text: text.substring(last, text.length),
			// entities: []
		});
	}
	return spans;
}


export class TextWithEntities {
	// spans = [];
	sentences = [];
	// @children('span') spanElements;
	@bindable text;
	@bindable mentions;
	@bindable entities;
	@bindable asList;

	constructor() {
		this.colors = colors['700'];
		// this.colors = colors['600'].concat(colors['800']);

		// from original material-ui colors module: import * as Colors from 'material-ui/styles/colors';
		// this.colors = [];
		// for (const key of Object.keys(colors)) {
		// 	if (key.substring(key.length - 3) === '700' && key[key.length - 4] !== 'A') {
		// 		this.colors.push(colors[key]);
		// 	}
		// }
	}

	textChanged() {
		this.asList = !(typeof this.text === "string");
		this.attached();
	}

	attached() {
		let text = typeof this.text === "string" ? [this.text] : this.text || [];
		let sentences = [];
		for(let sentence of text) {
			let spans = entitiesToSpanItems(this.mentions, sentence, this.entities);
			// add colors
			for(const span of spans) {
				if(span.color) {
					// span.color = this.colors[span.color % this.colors.length];
					span.color = this.colors[(span.color % Math.floor(this.colors.length/3))*3];	// use each 3rd color
				}
			}
			sentences.push(spans);
		}
		this.sentences = sentences;
	}
}
