import {inject, bindable, observable, bindingMode, Aurelia} from 'aurelia-framework';
// import {ViewFactory} from 'view-factory';
import {Container} from 'aurelia-dependency-injection';
import {CompositionEngine, ViewSlot, ViewResources, View} from 'aurelia-templating';

// import {ViewCompiler, createOverrideContext} from 'aurelia-framework';
import {ViewCompiler, createOverrideContextKH} from 'aurelia-templating';

// https://www.len.ro/work/dynamic-aurelia/

@inject(CompositionEngine, Container, ViewCompiler, ViewResources)
export class CompositionService {

	constructor(compositionEngine, container, viewCompiler, resources) {
		this.compositionEngine = compositionEngine;
		this.container = container;
		// for html compile
		this.viewCompiler = viewCompiler;
		this.resources = resources;
	}

	compile(viewModel, container, html) {
		let viewFactory = this.viewCompiler.compile(html, this.resources);
		let view = viewFactory.create(this.container);
		view.bind(viewModel, createOverrideContext(viewModel));
		let viewSlot = new ViewSlot(container, true);
		viewSlot.add(view);
		viewSlot.attached();
		// viewModel.attached();	// ???
		// returns destroy function, viewModel is already provided, what about controller ?
		return () => {
			viewSlot.remove(view);
			// console.log(view)
			// view.detached();		// ???
			view.unbind();
		};
	}

	async create(viewModel, container, options, returnController) {
		if(!(container instanceof Element)) {
			returnController = options;
			options = container;
			container = document.body;
		}
		if(typeof options === 'boolean') {
			returnController = options;
			options = undefined;
		}
		options = Object.assign({
			anchor: container,
			anchorIsContainer: true,
		}, options || {});
		let viewSlot = new ViewSlot(options.anchor || options.container, options.anchorIsContainer, options.animator);
		let instruction = Object.assign({
			container: this.container,
			viewModel,
			viewSlot,
			host: options.anchor,
            // bindingContext: bindingContext,		// this
            // overrideContext: overrideContext,	// this
		}, options.instruction || {});
		returnController = options.returnController || returnController;
		let controller = await this.compositionEngine.compose(instruction);
		if(returnController) {
			return controller;
		}
		viewSlot.bind();
		viewSlot.attached();
		// return controller and destroy function
		return [controller, () => {
			viewSlot.remove(controller.view);
			controller.view.unbind();
		}];
	}

	async createAtBody(viewModel, animator) {
		let element = document.body;
		let viewSlot = new ViewSlot(element, true, animator);	// ViewSlot(anchor: Node, anchorIsContainer: boolean, animator?: Animator)
		let instruction = {
			container: this.container,
			viewModel,
			viewSlot,
			host: element,
            // bindingContext: bindingContext,
            // overrideContext: this,
		};
		let controller = await this.compositionEngine.compose(instruction);
		viewSlot.bind();
		viewSlot.attached();
		// return view model and destroy function
		return [controller.viewModel, () => {
			viewSlot.remove(controller.view);
			controller.view.unbind();
		}];
	}


	async openDialog(viewModel, model, options, animator) {
		let element = document.body;
		let viewSlot = new ViewSlot(element, true, animator);	// ViewSlot(anchor: Node, anchorIsContainer: boolean, animator?: Animator)
		if(typeof viewModel !== 'string') {
			viewModel.model = model;
		}
		let instruction = {
			container: this.container,
			viewModel,
			viewSlot,
			host: element,
            // bindingContext: bindingContext,
            // overrideContext: this,
		};
		let controller = await this.compositionEngine.compose(instruction);
		viewSlot.bind();
		viewSlot.attached();

		// alternative: return view model, and destroy function
		// return controller.viewModel, () => {
		// 	viewSlot.remove(controller.view);
		// 	controller.view.unbind();
		// };
		
		let result = await controller.viewModel.open(model, options);
		// console.log('CONTROLLER:', controller);
		// console.log('VIEW:', controller.view);
		// console.log('VIEW MODEL:', controller.viewModel);
		viewSlot.remove(controller.view);
		controller.view.unbind();
		return result;
	}
}
