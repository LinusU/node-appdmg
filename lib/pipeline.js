'use strict'

const EventEmitter = require('events').EventEmitter

class Pipeline extends EventEmitter {
  constructor () {
    super()

    this.steps = []
    this.totalSteps = 0
    this.currentStep = 0
    this._waitQueue = []

    this.cleanupList = []
    this.cleanupStore = {}
  }

  async _wait () {
    // Drain the waitingFor queue. Wait on every promise that gets added to the queue. Only return once there are no promises left in the queue.
    let waitOn

    // Although assignment expressions are normally prohibited by StandardJS, the only other way I know of to write this is with a while (true) loop, which is dangerous.
    // eslint-disable-next-line no-cond-assign
    while (waitOn = this._waitQueue.pop()) {
      await waitOn
    }
  }

  _progress (obj) {
    obj.current = this.currentStep
    obj.total = this.totalSteps

    this.emit('progress', obj)
  }

  _runStep (step, nextAction, cb) {
    const next = (err) => {
      if (err) {
        this._progress({ type: 'step-end', status: 'error' })
        this.hasErrored = true
        this.runRemainingCleanups(function (err2) {
          if (err2) console.error(err2)
          cb(err)
        })
      } else {
        this._progress({ type: 'step-end', status: 'ok' })
        this._wait().then(() => this[nextAction](cb), cb)
      }
    }

    next.skip = () => {
      this._progress({ type: 'step-end', status: 'skip' })
      this._wait().then(() => this[nextAction](cb), cb)
    }

    this.currentStep++
    this._progress({ type: 'step-begin', title: step.title })
    this._wait().then(() => step.fn(next), next)
  }

  addStep (title, fn) {
    this.totalSteps++
    this.steps.push({ title: title, fn: fn })
  }

  addCleanupStep (id, title, fn) {
    this.cleanupList.push(id)
    this.cleanupStore[id] = { title: title, fn: fn }
  }

  expectAdditional (n) {
    this.totalSteps += n
  }

  runCleanup (id, cb) {
    const fn = this.cleanupStore[id].fn
    const idx = this.cleanupList.indexOf(id)

    if (idx === -1) throw new Error(`No step with id: ${id}`)

    delete this.cleanupStore[id]
    this.cleanupList.splice(idx, 1)

    return fn(cb, this.hasErrored)
  }

  runRemainingCleanups (cb) {
    if (this.cleanupList.length === 0) return cb(null)

    const idx = this.cleanupList.length - 1
    const id = this.cleanupList[idx]

    const step = {
      title: this.cleanupStore[id].title,
      fn: (cb) => this.runCleanup(id, cb)
    }

    this._runStep(step, 'runRemainingCleanups', cb)
  }

  _run (cb) {
    if (this.steps.length === 0) return this.runRemainingCleanups(cb)

    const step = this.steps.shift()

    this._runStep(step, '_run', cb)
  }

  run () {
    process.nextTick(() => {
      this._run((err) => {
        if (err) {
          this._completed = { err }
          this.emit('error', err)
        } else {
          this._completed = true
          this.emit('finish')
        }
      })
    })

    return this
  }

  waitFor (promise) {
    this._waitQueue.push(promise)

    // Suppress unhandled promise rejection warnings. Rejections will be handled later.
    promise.catch(() => {})
  }

  abort (err) {
    this.waitFor(Promise.reject(err))
  }

  get asPromise () {
    let { _asPromise: p } = this

    if (!p) {
      const { _completed: c } = this

      if (c === true) {
        p = Promise.resolve()
      } else if (typeof c === 'object' && 'err' in c) {
        p = Promise.reject(c.err)
      } else {
        p = new Promise((resolve, reject) => {
          this.once('finish', resolve)
          this.once('error', reject)
        })
      }

      this._asPromise = p
    }

    return p
  }
}

module.exports = Pipeline
