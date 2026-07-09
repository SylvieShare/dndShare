export function replaceObjectInArrayByKey(arr, key, newObj) {
    const index = arr.findIndex(obj => obj[key] === newObj[key]);
    if (index > -1) {
        arr.splice(index, 1, newObj);
    }
    return arr;
}

export function toMultiMap(list, f) {
    let map = new Map()
    list.forEach(sp => {
        let k = f(sp)
        if (!map.has(k)) {
            map.set(k, []);
        }
        map.get(k).push(sp);
    })
    return map
}

export function toMap(list, f) {
    let map = new Map()
    list.forEach(sp => map.set(f(sp), sp))
    return map
}