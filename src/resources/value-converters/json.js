
export class JsonValueConverter {
  toView(obj) {
    return JSON.stringify(obj);
  }
}
export class JsonPrettyValueConverter {
  toView(obj) {
    return JSON.stringify(obj,null,4);
  }
}
