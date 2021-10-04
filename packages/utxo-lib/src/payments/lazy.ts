export function prop(object: Record<string, any>, name: string, f: () => any) {
    Object.defineProperty(object, name, {
        configurable: true,
        enumerable: true,
        get() {
            const value = f.call(this);
            this[name] = value;
            return value;
        },
        set(_value: any) {
            Object.defineProperty(this, name, {
                configurable: true,
                enumerable: true,
                value: _value,
                writable: true,
            });
        },
    });
}

export function value<T>(f: () => T): () => T {
    let value: T;
    return (): T => {
        if (value !== undefined) return value;
        value = f();
        return value;
    };
}
