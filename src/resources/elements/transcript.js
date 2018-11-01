import {inject, bindable, observable, bindingMode, children} from 'aurelia-framework';
import log from 'logger';
import $ from 'jquery';


export class Transcript {
	@bindable({defaultBindingMode: bindingMode.twoWay}) time;
	@bindable segments;
	spans = [];
	@children('span') spanElements;
	@bindable({defaultBindingMode:bindingMode.oneWay}) video = undefined;
	@bindable rtl;

	// currentTime = 0;
	currentIndex = 0;

	constructor() {
		this.timeUpdate = () => { if(this.video) { this.timeChanged(this.video.currentTime); } };

		// for finer transcript hops
		this.animationFrame = timestamp => {
			const time = this.video.currentTime;
			if(time !== this.lastTime) {
				if(time >= this.nextTimeCheckpoint) {
					this.timeChanged(time);
				}
				this.lastTime = time;
			}
			this.animationFrameID = requestAnimationFrame(this.animationFrame);
		};

		this.videoPlay = () => {
			this.animationFrameID = requestAnimationFrame(this.animationFrame);
		};

		this.videoPause = () => {
			if(this.animationFrameID) {
				cancelAnimationFrame(this.animationFrameID);
				this.animationFrameID = undefined;
			}
		};
	}

	detached() {
		this.videoPause();
	}

	videoChanged(video, oldVideo) {
		if(oldVideo) {
			oldVideo.removeEventListener('timeupdate', this.timeUpdate);
			oldVideo.removeEventListener('play', this.videoPlay);
			oldVideo.removeEventListener('pause', this.videoPause);
		}
		if(video) {
			video.addEventListener('timeupdate', this.timeUpdate);
			video.addEventListener('play', this.videoPlay);
			video.addEventListener('pause', this.videoPause);
		}
		this.nextTimeCheckpoint = 0;
	}

	segmentsChanged() {
		// this.currentTime = 0;
		this.currentIndex = 0;
		let spans = this.spans = [];
		const threshold = 5;
		let last;
		const addSpan = span => {
			if(last) {
				const end = last.time + last.duration;
				const pause = span.time - end;
				if(pause >= threshold) {
					const ndots = ' . . . ' + (pause < 60 ? pause.toFixed(0)+'s' : (pause/60).toFixed(0)+'m') + ' . . . ';
					const dots = pause <= 20 ? (new Array(parseInt(pause)+1)).join(' .')+' ' : ' . . . '+ndots+' . . . ';
					// this is for text display:
					// const display = '';
					// const display = '[ . . . ]';
					const display = '['+dots+']';
					// const display = '['+ndots+']';
					// this is for text copy:
					// const copy = ''
					// const copy = '['+dots+']';
					const copy = '['+ndots+']';

					spans.push({
						confidence: 0.5,
						duration: pause,
						time: end,
						word: copy,			// this is for text copy [and display if non-zero font size is set up]
						pseudo: display,	// this is for text display only
						pause: true
					});
				}
			}
			spans.push(span);
			last = span;
		}
		for(let chunk of this.segments) {
			if(chunk instanceof Array) {
				for(let span of chunk) {
					addSpan(span);
				}
			} else {
				addSpan(chunk);
			}
		}
		// console.log('segments changed');
	}

	select(index) {
		let span = this.spans[index];
		let time = span.time + span.duration*0.5;
		// this.nextTimeCheckpoint = span.time + span.duration;
		this.nextTimeCheckpoint = 0;
		this.video.currentTime = time;
	}

	spanElementsChanged() {
		// this.currentTime = 0;
		this.currentIndex = 0;
		// console.log('span elements:', this.spanElements);
	}

	timeChanged(time, oldTime) {
		oldTime = this.lastTime;
		if(!this.spans || !this.spanElements) {
			return;
		}
		// if(time < this.currentTime) {
		if(oldTime !== undefined && time === oldTime) {
			return;
		}
		const currentSpan = this.currentIndex !== null && this.spans[this.currentIndex];
		// if((currentSpan && currentSpan.time <= time && time < currentSpan.time) || (!currentSpan && time < this.nextTimeCheckpoint)) {
		if(currentSpan && currentSpan.time <= time && time < currentSpan.time) {
			return;	// nothing changed
		}
		let newIndex = null;
		let i = oldTime === undefined || !this.currentIndex || time < this.spans[this.currentIndex].time ? 0 : this.currentIndex;
		let count = this.spans.length;
		let spans = this.spans;
		while(i < count) {
			let span = spans[i];
			if(span.time <= time && time <= span.time+span.duration) {
				newIndex = i;
				this.nextTimeCheckpoint = span.time+span.duration;
				break;
			} else if(span.time > time) {
				this.nextTimeCheckpoint = span.time;
				break;
			}
			++i;
		}
		this.lastTime = time;
		if(this.currentIndex !== undefined && this.currentIndex !== null && newIndex !== this.currentIndex) {
			// $(this.spanElements[this.currentIndex]).removeClass('active');
			this.spanElements[this.currentIndex].classList.remove('active');
		}
		if(newIndex !== null && newIndex !== this.currentIndex) {
			// $(this.spanElements[newIndex]).addClass('active');
			this.spanElements[newIndex].classList.add('active');
			// remove old active
			// add new active
		}
		this.currentIndex = newIndex;

		// this.currentTime = time;
	}
}
