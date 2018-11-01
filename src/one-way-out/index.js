// Patch binding engine: add one-way-out binding
import {SyntaxInterpreter} from 'aurelia-templating-binding';
import {BindingExpression, bindingMode, Binding} from 'aurelia-binding';
import {BehaviorInstruction} from 'aurelia-templating';

export function configure(config) {
	// Patch binding engine
	let syntaxInterpreter = config.aurelia.container.get(SyntaxInterpreter);
	// https://github.com/aurelia/binding/blob/master/src/binding-mode.js
	bindingMode.oneWayOut = 3;
	// https://github.com/aurelia/templating-binding/blob/master/src/syntax-interpreter.js
	syntaxInterpreter['one-way-out'] = (resources, element, info, existingInstruction) => {
		let instruction = existingInstruction || BehaviorInstruction.attribute(info.attrName);
		instruction.attributes[info.attrName] = new BindingExpression(
			syntaxInterpreter.observerLocator,
			syntaxInterpreter.attributeMap.map(element.tagName, info.attrName),
			syntaxInterpreter.parser.parse(info.attrValue),
			bindingMode.oneWayOut,
			resources.lookupFunctions
		);
		return instruction;
	}
	// https://github.com/aurelia/binding/blob/master/src/binding-expression.js#L17
	BindingExpression.prototype.createBinding = function (target) {
		let mode = this.mode === bindingMode.oneWayOut ? bindingMode.twoWay : this.mode;	// implement one-way-out as two-way without updateTarget
		let binding = new Binding(
			this.observerLocator,
			this.sourceExpression,
			target,
			this.targetProperty,
			mode,
			this.lookupFunctions
		);
		if(this.mode == bindingMode.oneWayOut) {
			binding.updateTarget = () => {};	// remove updateTarget
		}
		return binding;
	};
}
