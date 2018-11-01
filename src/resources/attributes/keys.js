
export class KeysValueConverter {
  toView(obj) {
	if(!obj)
		return [];
	let keys = Reflect.ownKeys(obj);
	let observersIndex = keys.indexOf("__observers__");
	if(observersIndex != -1)
		keys.splice(observersIndex, 1);
    return keys;
    // return Reflect.ownKeys(obj);
  }
}
