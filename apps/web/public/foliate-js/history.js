/** Session-local, bounded navigation; pointer changes only after a successful landing. */
export class History extends EventTarget {
    #arr = []
    #index = -1
    #epoch = 0
    #tail = Promise.resolve()
    #navigate
    constructor(navigate) { super(); this.#navigate = navigate }
    #change() { this.dispatchEvent(new Event('index-change')) }
    pushState(value) {
        const current = this.#arr[this.#index]
        if (current === value || (typeof current?.fraction === 'number' && current.fraction === value?.fraction)) return
        this.#arr.splice(this.#index + 1)
        this.#arr.push(value)
        if (this.#arr.length > 100) this.#arr.shift()
        this.#index = this.#arr.length - 1
        this.#change()
    }
    replaceState(value) { if (this.#index < 0) this.pushState(value); else this.#arr[this.#index] = value }
    back() { return this.#move(-1) }
    forward() { return this.#move(1) }
    #move(direction) {
        const epoch = this.#epoch
        const work = this.#tail.catch(() => {}).then(async () => {
            if (epoch !== this.#epoch) return false
            const index = this.#index + direction
            if (index < 0 || index >= this.#arr.length) return false
            const state = this.#arr[index]
            await this.#navigate(state)
            if (epoch !== this.#epoch) return false
            this.#index = index
            this.#change()
            this.dispatchEvent(new CustomEvent('popstate', {detail:{state}}))
            return true
        })
        this.#tail = work.catch(() => {})
        return work
    }
    get canGoBack() { return this.#index > 0 }
    get canGoForward() { return this.#index >= 0 && this.#index < this.#arr.length - 1 }
    clear() { this.#epoch++; this.#arr = []; this.#index = -1; this.#change() }
}
