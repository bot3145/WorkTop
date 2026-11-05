(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/scheduler/cjs/scheduler.production.js
  var require_scheduler_production = __commonJS({
    "node_modules/scheduler/cjs/scheduler.production.js"(exports) {
      "use strict";
      function push(heap, node) {
        var index = heap.length;
        heap.push(node);
        a: for (; 0 < index; ) {
          var parentIndex = index - 1 >>> 1, parent = heap[parentIndex];
          if (0 < compare(parent, node))
            heap[parentIndex] = node, heap[index] = parent, index = parentIndex;
          else break a;
        }
      }
      function peek(heap) {
        return 0 === heap.length ? null : heap[0];
      }
      function pop(heap) {
        if (0 === heap.length) return null;
        var first = heap[0], last = heap.pop();
        if (last !== first) {
          heap[0] = last;
          a: for (var index = 0, length = heap.length, halfLength = length >>> 1; index < halfLength; ) {
            var leftIndex = 2 * (index + 1) - 1, left = heap[leftIndex], rightIndex = leftIndex + 1, right = heap[rightIndex];
            if (0 > compare(left, last))
              rightIndex < length && 0 > compare(right, left) ? (heap[index] = right, heap[rightIndex] = last, index = rightIndex) : (heap[index] = left, heap[leftIndex] = last, index = leftIndex);
            else if (rightIndex < length && 0 > compare(right, last))
              heap[index] = right, heap[rightIndex] = last, index = rightIndex;
            else break a;
          }
        }
        return first;
      }
      function compare(a, b) {
        var diff = a.sortIndex - b.sortIndex;
        return 0 !== diff ? diff : a.id - b.id;
      }
      exports.unstable_now = void 0;
      if ("object" === typeof performance && "function" === typeof performance.now) {
        localPerformance = performance;
        exports.unstable_now = function() {
          return localPerformance.now();
        };
      } else {
        localDate = Date, initialTime = localDate.now();
        exports.unstable_now = function() {
          return localDate.now() - initialTime;
        };
      }
      var localPerformance;
      var localDate;
      var initialTime;
      var taskQueue = [];
      var timerQueue = [];
      var taskIdCounter = 1;
      var currentTask = null;
      var currentPriorityLevel = 3;
      var isPerformingWork = false;
      var isHostCallbackScheduled = false;
      var isHostTimeoutScheduled = false;
      var needsPaint = false;
      var localSetTimeout = "function" === typeof setTimeout ? setTimeout : null;
      var localClearTimeout = "function" === typeof clearTimeout ? clearTimeout : null;
      var localSetImmediate = "undefined" !== typeof setImmediate ? setImmediate : null;
      function advanceTimers(currentTime) {
        for (var timer = peek(timerQueue); null !== timer; ) {
          if (null === timer.callback) pop(timerQueue);
          else if (timer.startTime <= currentTime)
            pop(timerQueue), timer.sortIndex = timer.expirationTime, push(taskQueue, timer);
          else break;
          timer = peek(timerQueue);
        }
      }
      function handleTimeout(currentTime) {
        isHostTimeoutScheduled = false;
        advanceTimers(currentTime);
        if (!isHostCallbackScheduled)
          if (null !== peek(taskQueue))
            isHostCallbackScheduled = true, isMessageLoopRunning || (isMessageLoopRunning = true, schedulePerformWorkUntilDeadline());
          else {
            var firstTimer = peek(timerQueue);
            null !== firstTimer && requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
          }
      }
      var isMessageLoopRunning = false;
      var taskTimeoutID = -1;
      var frameInterval = 5;
      var startTime = -1;
      function shouldYieldToHost() {
        return needsPaint ? true : exports.unstable_now() - startTime < frameInterval ? false : true;
      }
      function performWorkUntilDeadline() {
        needsPaint = false;
        if (isMessageLoopRunning) {
          var currentTime = exports.unstable_now();
          startTime = currentTime;
          var hasMoreWork = true;
          try {
            a: {
              isHostCallbackScheduled = false;
              isHostTimeoutScheduled && (isHostTimeoutScheduled = false, localClearTimeout(taskTimeoutID), taskTimeoutID = -1);
              isPerformingWork = true;
              var previousPriorityLevel = currentPriorityLevel;
              try {
                b: {
                  advanceTimers(currentTime);
                  for (currentTask = peek(taskQueue); null !== currentTask && !(currentTask.expirationTime > currentTime && shouldYieldToHost()); ) {
                    var callback = currentTask.callback;
                    if ("function" === typeof callback) {
                      currentTask.callback = null;
                      currentPriorityLevel = currentTask.priorityLevel;
                      var continuationCallback = callback(
                        currentTask.expirationTime <= currentTime
                      );
                      currentTime = exports.unstable_now();
                      if ("function" === typeof continuationCallback) {
                        currentTask.callback = continuationCallback;
                        advanceTimers(currentTime);
                        hasMoreWork = true;
                        break b;
                      }
                      currentTask === peek(taskQueue) && pop(taskQueue);
                      advanceTimers(currentTime);
                    } else pop(taskQueue);
                    currentTask = peek(taskQueue);
                  }
                  if (null !== currentTask) hasMoreWork = true;
                  else {
                    var firstTimer = peek(timerQueue);
                    null !== firstTimer && requestHostTimeout(
                      handleTimeout,
                      firstTimer.startTime - currentTime
                    );
                    hasMoreWork = false;
                  }
                }
                break a;
              } finally {
                currentTask = null, currentPriorityLevel = previousPriorityLevel, isPerformingWork = false;
              }
              hasMoreWork = void 0;
            }
          } finally {
            hasMoreWork ? schedulePerformWorkUntilDeadline() : isMessageLoopRunning = false;
          }
        }
      }
      var schedulePerformWorkUntilDeadline;
      if ("function" === typeof localSetImmediate)
        schedulePerformWorkUntilDeadline = function() {
          localSetImmediate(performWorkUntilDeadline);
        };
      else if ("undefined" !== typeof MessageChannel) {
        channel = new MessageChannel(), port = channel.port2;
        channel.port1.onmessage = performWorkUntilDeadline;
        schedulePerformWorkUntilDeadline = function() {
          port.postMessage(null);
        };
      } else
        schedulePerformWorkUntilDeadline = function() {
          localSetTimeout(performWorkUntilDeadline, 0);
        };
      var channel;
      var port;
      function requestHostTimeout(callback, ms) {
        taskTimeoutID = localSetTimeout(function() {
          callback(exports.unstable_now());
        }, ms);
      }
      exports.unstable_IdlePriority = 5;
      exports.unstable_ImmediatePriority = 1;
      exports.unstable_LowPriority = 4;
      exports.unstable_NormalPriority = 3;
      exports.unstable_Profiling = null;
      exports.unstable_UserBlockingPriority = 2;
      exports.unstable_cancelCallback = function(task) {
        task.callback = null;
      };
      exports.unstable_forceFrameRate = function(fps) {
        0 > fps || 125 < fps ? console.error(
          "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
        ) : frameInterval = 0 < fps ? Math.floor(1e3 / fps) : 5;
      };
      exports.unstable_getCurrentPriorityLevel = function() {
        return currentPriorityLevel;
      };
      exports.unstable_next = function(eventHandler) {
        switch (currentPriorityLevel) {
          case 1:
          case 2:
          case 3:
            var priorityLevel = 3;
            break;
          default:
            priorityLevel = currentPriorityLevel;
        }
        var previousPriorityLevel = currentPriorityLevel;
        currentPriorityLevel = priorityLevel;
        try {
          return eventHandler();
        } finally {
          currentPriorityLevel = previousPriorityLevel;
        }
      };
      exports.unstable_requestPaint = function() {
        needsPaint = true;
      };
      exports.unstable_runWithPriority = function(priorityLevel, eventHandler) {
        switch (priorityLevel) {
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
            break;
          default:
            priorityLevel = 3;
        }
        var previousPriorityLevel = currentPriorityLevel;
        currentPriorityLevel = priorityLevel;
        try {
          return eventHandler();
        } finally {
          currentPriorityLevel = previousPriorityLevel;
        }
      };
      exports.unstable_scheduleCallback = function(priorityLevel, callback, options) {
        var currentTime = exports.unstable_now();
        "object" === typeof options && null !== options ? (options = options.delay, options = "number" === typeof options && 0 < options ? currentTime + options : currentTime) : options = currentTime;
        switch (priorityLevel) {
          case 1:
            var timeout = -1;
            break;
          case 2:
            timeout = 250;
            break;
          case 5:
            timeout = 1073741823;
            break;
          case 4:
            timeout = 1e4;
            break;
          default:
            timeout = 5e3;
        }
        timeout = options + timeout;
        priorityLevel = {
          id: taskIdCounter++,
          callback,
          priorityLevel,
          startTime: options,
          expirationTime: timeout,
          sortIndex: -1
        };
        options > currentTime ? (priorityLevel.sortIndex = options, push(timerQueue, priorityLevel), null === peek(taskQueue) && priorityLevel === peek(timerQueue) && (isHostTimeoutScheduled ? (localClearTimeout(taskTimeoutID), taskTimeoutID = -1) : isHostTimeoutScheduled = true, requestHostTimeout(handleTimeout, options - currentTime))) : (priorityLevel.sortIndex = timeout, push(taskQueue, priorityLevel), isHostCallbackScheduled || isPerformingWork || (isHostCallbackScheduled = true, isMessageLoopRunning || (isMessageLoopRunning = true, schedulePerformWorkUntilDeadline())));
        return priorityLevel;
      };
      exports.unstable_shouldYield = shouldYieldToHost;
      exports.unstable_wrapCallback = function(callback) {
        var parentPriorityLevel = currentPriorityLevel;
        return function() {
          var previousPriorityLevel = currentPriorityLevel;
          currentPriorityLevel = parentPriorityLevel;
          try {
            return callback.apply(this, arguments);
          } finally {
            currentPriorityLevel = previousPriorityLevel;
          }
        };
      };
    }
  });

  // node_modules/scheduler/index.js
  var require_scheduler = __commonJS({
    "node_modules/scheduler/index.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_scheduler_production();
      } else {
        module.exports = null;
      }
    }
  });

  // node_modules/react/cjs/react.production.js
  var require_react_production = __commonJS({
    "node_modules/react/cjs/react.production.js"(exports) {
      "use strict";
      var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element");
      var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
      var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
      var REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode");
      var REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler");
      var REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer");
      var REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context");
      var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
      var REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense");
      var REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo");
      var REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy");
      var REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity");
      var REACT_VIEW_TRANSITION_TYPE = /* @__PURE__ */ Symbol.for("react.view_transition");
      var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
      function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
      }
      var ReactNoopUpdateQueue = {
        isMounted: function() {
          return false;
        },
        enqueueForceUpdate: function() {
        },
        enqueueReplaceState: function() {
        },
        enqueueSetState: function() {
        }
      };
      var assign = Object.assign;
      var emptyObject = {};
      function Component(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      Component.prototype.isReactComponent = {};
      Component.prototype.setState = function(partialState, callback) {
        if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
          throw Error(
            "takes an object of state variables to update or a function which returns an object of state variables."
          );
        this.updater.enqueueSetState(this, partialState, callback, "setState");
      };
      Component.prototype.forceUpdate = function(callback) {
        this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
      };
      function ComponentDummy() {
      }
      ComponentDummy.prototype = Component.prototype;
      function PureComponent(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
      pureComponentPrototype.constructor = PureComponent;
      assign(pureComponentPrototype, Component.prototype);
      pureComponentPrototype.isPureReactComponent = true;
      var isArrayImpl = Array.isArray;
      function noop() {
      }
      var ReactSharedInternals = { H: null, A: null, T: null, S: null };
      var hasOwnProperty = Object.prototype.hasOwnProperty;
      function ReactElement(type, key, props) {
        var refProp = props.ref;
        return {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key,
          ref: void 0 !== refProp ? refProp : null,
          props
        };
      }
      function cloneAndReplaceKey(oldElement, newKey) {
        return ReactElement(oldElement.type, newKey, oldElement.props);
      }
      function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
      }
      function escape(key) {
        var escaperLookup = { "=": "=0", ":": "=2" };
        return "$" + key.replace(/[=:]/g, function(match) {
          return escaperLookup[match];
        });
      }
      var userProvidedKeyEscapeRegex = /\/+/g;
      function getElementKey(element, index) {
        return "object" === typeof element && null !== element && null != element.key ? escape("" + element.key) : index.toString(36);
      }
      function resolveThenable(thenable) {
        switch (thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenable.reason;
          default:
            switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
              function(fulfilledValue) {
                "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
              },
              function(error) {
                "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            )), thenable.status) {
              case "fulfilled":
                return thenable.value;
              case "rejected":
                throw thenable.reason;
            }
        }
        throw thenable;
      }
      function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
        var type = typeof children;
        if ("undefined" === type || "boolean" === type) children = null;
        var invokeCallback = false;
        if (null === children) invokeCallback = true;
        else
          switch (type) {
            case "bigint":
            case "string":
            case "number":
              invokeCallback = true;
              break;
            case "object":
              switch (children.$$typeof) {
                case REACT_ELEMENT_TYPE:
                case REACT_PORTAL_TYPE:
                  invokeCallback = true;
                  break;
                case REACT_LAZY_TYPE:
                  return invokeCallback = children._init, mapIntoArray(
                    invokeCallback(children._payload),
                    array,
                    escapedPrefix,
                    nameSoFar,
                    callback
                  );
              }
          }
        if (invokeCallback)
          return callback = callback(children), invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", null != invokeCallback && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
            return c;
          })) : null != callback && (isValidElement(callback) && (callback = cloneAndReplaceKey(
            callback,
            escapedPrefix + (null == callback.key || children && children.key === callback.key ? "" : ("" + callback.key).replace(
              userProvidedKeyEscapeRegex,
              "$&/"
            ) + "/") + invokeCallback
          )), array.push(callback)), 1;
        invokeCallback = 0;
        var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
        if (isArrayImpl(children))
          for (var i = 0; i < children.length; i++)
            nameSoFar = children[i], type = nextNamePrefix + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if (i = getIteratorFn(children), "function" === typeof i)
          for (children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
            nameSoFar = nameSoFar.value, type = nextNamePrefix + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if ("object" === type) {
          if ("function" === typeof children.then)
            return mapIntoArray(
              resolveThenable(children),
              array,
              escapedPrefix,
              nameSoFar,
              callback
            );
          array = String(children);
          throw Error(
            "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
          );
        }
        return invokeCallback;
      }
      function mapChildren(children, func, context) {
        if (null == children) return children;
        var result = [], count = 0;
        mapIntoArray(children, result, "", "", function(child) {
          return func.call(context, child, count++);
        });
        return result;
      }
      function lazyInitializer(payload) {
        if (-1 === payload._status) {
          var ctor = payload._result, thenable = ctor();
          thenable.then(
            function(moduleObject) {
              if (0 === payload._status || -1 === payload._status)
                payload._status = 1, payload._result = moduleObject, void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
            },
            function(error) {
              if (0 === payload._status || -1 === payload._status)
                payload._status = 2, payload._result = error, void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error);
            }
          );
          -1 === payload._status && (payload._status = 0, payload._result = thenable);
        }
        if (1 === payload._status) return payload._result.default;
        throw payload._result;
      }
      var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
        if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
          var event = new window.ErrorEvent("error", {
            bubbles: true,
            cancelable: true,
            message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
            error
          });
          if (!window.dispatchEvent(event)) return;
        } else if ("object" === typeof process && "function" === typeof process.emit) {
          process.emit("uncaughtException", error);
          return;
        }
        console.error(error);
      };
      function startTransition(scope) {
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        currentTransition.types = null !== prevTransition ? prevTransition.types : null;
        ReactSharedInternals.T = currentTransition;
        try {
          var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
          null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
          "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
        } catch (error) {
          reportGlobalError(error);
        } finally {
          null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
        }
      }
      function addTransitionType(type) {
        var transition = ReactSharedInternals.T;
        if (null !== transition) {
          var transitionTypes = transition.types;
          null === transitionTypes ? transition.types = [type] : -1 === transitionTypes.indexOf(type) && transitionTypes.push(type);
        } else startTransition(addTransitionType.bind(null, type));
      }
      var Children = {
        map: mapChildren,
        forEach: function(children, forEachFunc, forEachContext) {
          mapChildren(
            children,
            function() {
              forEachFunc.apply(this, arguments);
            },
            forEachContext
          );
        },
        count: function(children) {
          var n = 0;
          mapChildren(children, function() {
            n++;
          });
          return n;
        },
        toArray: function(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        },
        only: function(children) {
          if (!isValidElement(children))
            throw Error(
              "React.Children.only expected to receive a single React element child."
            );
          return children;
        }
      };
      exports.Activity = REACT_ACTIVITY_TYPE;
      exports.Children = Children;
      exports.Component = Component;
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.Profiler = REACT_PROFILER_TYPE;
      exports.PureComponent = PureComponent;
      exports.StrictMode = REACT_STRICT_MODE_TYPE;
      exports.Suspense = REACT_SUSPENSE_TYPE;
      exports.ViewTransition = REACT_VIEW_TRANSITION_TYPE;
      exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
      exports.__COMPILER_RUNTIME = {
        __proto__: null,
        c: function(size) {
          return ReactSharedInternals.H.useMemoCache(size);
        }
      };
      exports.addTransitionType = addTransitionType;
      exports.cache = function(fn) {
        return function() {
          return fn.apply(null, arguments);
        };
      };
      exports.cacheSignal = function() {
        return null;
      };
      exports.cloneElement = function(element, config, children) {
        if (null === element || void 0 === element)
          throw Error(
            "The argument must be a React element, but you passed " + element + "."
          );
        var props = assign({}, element.props), key = element.key;
        if (null != config)
          for (propName in void 0 !== config.key && (key = "" + config.key), config)
            !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
        var propName = arguments.length - 2;
        if (1 === propName) props.children = children;
        else if (1 < propName) {
          for (var childArray = Array(propName), i = 0; i < propName; i++)
            childArray[i] = arguments[i + 2];
          props.children = childArray;
        }
        return ReactElement(element.type, key, props);
      };
      exports.createContext = function(defaultValue) {
        defaultValue = {
          $$typeof: REACT_CONTEXT_TYPE,
          _currentValue: defaultValue,
          _currentValue2: defaultValue,
          _threadCount: 0,
          Provider: null,
          Consumer: null
        };
        defaultValue.Provider = defaultValue;
        defaultValue.Consumer = {
          $$typeof: REACT_CONSUMER_TYPE,
          _context: defaultValue
        };
        return defaultValue;
      };
      exports.createElement = function(type, config, children) {
        var propName, props = {}, key = null;
        if (null != config)
          for (propName in void 0 !== config.key && (key = "" + config.key), config)
            hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (props[propName] = config[propName]);
        var childrenLength = arguments.length - 2;
        if (1 === childrenLength) props.children = children;
        else if (1 < childrenLength) {
          for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++)
            childArray[i] = arguments[i + 2];
          props.children = childArray;
        }
        if (type && type.defaultProps)
          for (propName in childrenLength = type.defaultProps, childrenLength)
            void 0 === props[propName] && (props[propName] = childrenLength[propName]);
        return ReactElement(type, key, props);
      };
      exports.createRef = function() {
        return { current: null };
      };
      exports.forwardRef = function(render) {
        return { $$typeof: REACT_FORWARD_REF_TYPE, render };
      };
      exports.isValidElement = isValidElement;
      exports.lazy = function(ctor) {
        return {
          $$typeof: REACT_LAZY_TYPE,
          _payload: { _status: -1, _result: ctor },
          _init: lazyInitializer
        };
      };
      exports.memo = function(type, compare) {
        return {
          $$typeof: REACT_MEMO_TYPE,
          type,
          compare: void 0 === compare ? null : compare
        };
      };
      exports.startTransition = startTransition;
      exports.unstable_useCacheRefresh = function() {
        return ReactSharedInternals.H.useCacheRefresh();
      };
      exports.use = function(usable) {
        return ReactSharedInternals.H.use(usable);
      };
      exports.useActionState = function(action, initialState, permalink) {
        return ReactSharedInternals.H.useActionState(action, initialState, permalink);
      };
      exports.useCallback = function(callback, deps) {
        return ReactSharedInternals.H.useCallback(callback, deps);
      };
      exports.useContext = function(Context) {
        return ReactSharedInternals.H.useContext(Context);
      };
      exports.useDebugValue = function() {
      };
      exports.useDeferredValue = function(value, initialValue) {
        return ReactSharedInternals.H.useDeferredValue(value, initialValue);
      };
      exports.useEffect = function(create, deps) {
        return ReactSharedInternals.H.useEffect(create, deps);
      };
      exports.useEffectEvent = function(callback) {
        return ReactSharedInternals.H.useEffectEvent(callback);
      };
      exports.useId = function() {
        return ReactSharedInternals.H.useId();
      };
      exports.useImperativeHandle = function(ref, create, deps) {
        return ReactSharedInternals.H.useImperativeHandle(ref, create, deps);
      };
      exports.useInsertionEffect = function(create, deps) {
        return ReactSharedInternals.H.useInsertionEffect(create, deps);
      };
      exports.useLayoutEffect = function(create, deps) {
        return ReactSharedInternals.H.useLayoutEffect(create, deps);
      };
      exports.useMemo = function(create, deps) {
        return ReactSharedInternals.H.useMemo(create, deps);
      };
      exports.useOptimistic = function(passthrough, reducer) {
        return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
      };
      exports.useReducer = function(reducer, initialArg, init) {
        return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
      };
      exports.useRef = function(initialValue) {
        return ReactSharedInternals.H.useRef(initialValue);
      };
      exports.useState = function(initialState) {
        return ReactSharedInternals.H.useState(initialState);
      };
      exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
        return ReactSharedInternals.H.useSyncExternalStore(
          subscribe,
          getSnapshot,
          getServerSnapshot
        );
      };
      exports.useTransition = function() {
        return ReactSharedInternals.H.useTransition();
      };
      exports.version = "19.3.1";
    }
  });

  // node_modules/react/index.js
  var require_react = __commonJS({
    "node_modules/react/index.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_react_production();
      } else {
        module.exports = null;
      }
    }
  });

  // node_modules/react-dom/cjs/react-dom.production.js
  var require_react_dom_production = __commonJS({
    "node_modules/react-dom/cjs/react-dom.production.js"(exports) {
      "use strict";
      var React = require_react();
      function formatProdErrorMessage(code) {
        var url = "https://react.dev/errors/" + code;
        if (1 < arguments.length) {
          url += "?args[]=" + encodeURIComponent(arguments[1]);
          for (var i = 2; i < arguments.length; i++)
            url += "&args[]=" + encodeURIComponent(arguments[i]);
        }
        return "Minified React error #" + code + "; visit " + url + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      function noop() {
      }
      var Internals = {
        d: {
          f: noop,
          r: function() {
            throw Error(formatProdErrorMessage(522));
          },
          D: noop,
          C: noop,
          L: noop,
          m: noop,
          X: noop,
          S: noop,
          M: noop
        },
        p: 0,
        findDOMNode: null
      };
      var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
      var REACT_RECOVERABLE_TYPE = /* @__PURE__ */ Symbol.for("react.recoverable");
      var REACT_OPTIMISTIC_KEY = /* @__PURE__ */ Symbol.for("react.optimistic_key");
      function createPortal$1(children, containerInfo, implementation) {
        var key = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
        return {
          $$typeof: REACT_PORTAL_TYPE,
          key: null == key ? null : key === REACT_OPTIMISTIC_KEY ? REACT_OPTIMISTIC_KEY : "" + key,
          children,
          containerInfo,
          implementation
        };
      }
      var ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      function getCrossOriginStringAs(as, input) {
        if ("font" === as) return "";
        if ("string" === typeof input)
          return "use-credentials" === input ? input : "";
      }
      exports.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = Internals;
      exports.browser = function(reason) {
        return { $$typeof: REACT_RECOVERABLE_TYPE, _reason: reason };
      };
      exports.createPortal = function(children, container) {
        var key = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
        if (!container || 1 !== container.nodeType && 9 !== container.nodeType && 11 !== container.nodeType)
          throw Error(formatProdErrorMessage(299));
        return createPortal$1(children, container, null, key);
      };
      exports.flushSync = function(fn) {
        var previousTransition = ReactSharedInternals.T, previousUpdatePriority = Internals.p;
        try {
          if (ReactSharedInternals.T = null, Internals.p = 2, fn) return fn();
        } finally {
          ReactSharedInternals.T = previousTransition, Internals.p = previousUpdatePriority, Internals.d.f();
        }
      };
      exports.preconnect = function(href, options) {
        "string" === typeof href && (options ? (options = options.crossOrigin, options = "string" === typeof options ? "use-credentials" === options ? options : "" : void 0) : options = null, Internals.d.C(href, options));
      };
      exports.prefetchDNS = function(href) {
        "string" === typeof href && Internals.d.D(href);
      };
      exports.preinit = function(href, options) {
        if ("string" === typeof href && options && "string" === typeof options.as) {
          var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin), integrity = "string" === typeof options.integrity ? options.integrity : void 0, fetchPriority = "string" === typeof options.fetchPriority ? options.fetchPriority : void 0;
          "style" === as ? Internals.d.S(
            href,
            "string" === typeof options.precedence ? options.precedence : void 0,
            {
              crossOrigin,
              integrity,
              fetchPriority
            }
          ) : "script" === as && Internals.d.X(href, {
            crossOrigin,
            integrity,
            fetchPriority,
            nonce: "string" === typeof options.nonce ? options.nonce : void 0
          });
        }
      };
      exports.preinitModule = function(href, options) {
        if ("string" === typeof href)
          if ("object" === typeof options && null !== options) {
            if (null == options.as || "script" === options.as) {
              var crossOrigin = getCrossOriginStringAs(
                options.as,
                options.crossOrigin
              );
              Internals.d.M(href, {
                crossOrigin,
                integrity: "string" === typeof options.integrity ? options.integrity : void 0,
                nonce: "string" === typeof options.nonce ? options.nonce : void 0,
                fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0
              });
            }
          } else null == options && Internals.d.M(href);
      };
      exports.preload = function(href, options) {
        if ("string" === typeof href && "object" === typeof options && null !== options && "string" === typeof options.as) {
          var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin);
          Internals.d.L(href, as, {
            crossOrigin,
            integrity: "string" === typeof options.integrity ? options.integrity : void 0,
            nonce: "string" === typeof options.nonce ? options.nonce : void 0,
            type: "string" === typeof options.type ? options.type : void 0,
            fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0,
            referrerPolicy: "string" === typeof options.referrerPolicy ? options.referrerPolicy : void 0,
            imageSrcSet: "string" === typeof options.imageSrcSet ? options.imageSrcSet : void 0,
            imageSizes: "string" === typeof options.imageSizes ? options.imageSizes : void 0,
            media: "string" === typeof options.media ? options.media : void 0
          });
        }
      };
      exports.preloadModule = function(href, options) {
        if ("string" === typeof href)
          if (options) {
            var crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
            Internals.d.m(href, {
              as: "string" === typeof options.as && "script" !== options.as ? options.as : void 0,
              crossOrigin,
              integrity: "string" === typeof options.integrity ? options.integrity : void 0,
              nonce: "string" === typeof options.nonce ? options.nonce : void 0,
              fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0
            });
          } else Internals.d.m(href);
      };
      exports.requestFormReset = function(form) {
        Internals.d.r(form);
      };
      exports.unstable_batchedUpdates = function(fn, a) {
        return fn(a);
      };
      exports.useFormState = function(action, initialState, permalink) {
        return ReactSharedInternals.H.useFormState(action, initialState, permalink);
      };
      exports.useFormStatus = function() {
        return ReactSharedInternals.H.useHostTransitionStatus();
      };
      exports.version = "19.3.1";
    }
  });

  // node_modules/react-dom/index.js
  var require_react_dom = __commonJS({
    "node_modules/react-dom/index.js"(exports, module) {
      "use strict";
      function checkDCE() {
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
          return;
        }
        if (false) {
          throw new Error("^_^");
        }
        try {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
        } catch (err) {
          console.error(err);
        }
      }
      if (true) {
        checkDCE();
        module.exports = require_react_dom_production();
      } else {
        module.exports = null;
      }
    }
  });

  // node_modules/react-dom/cjs/react-dom-client.production.js
  var require_react_dom_client_production = __commonJS({
    "node_modules/react-dom/cjs/react-dom-client.production.js"(exports) {
      "use strict";
      var Scheduler = require_scheduler();
      var React = require_react();
      var ReactDOM = require_react_dom();
      function formatProdErrorMessage(code) {
        var url = "https://react.dev/errors/" + code;
        if (1 < arguments.length) {
          url += "?args[]=" + encodeURIComponent(arguments[1]);
          for (var i = 2; i < arguments.length; i++)
            url += "&args[]=" + encodeURIComponent(arguments[i]);
        }
        return "Minified React error #" + code + "; visit " + url + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      function isValidContainer(node) {
        return !(!node || 1 !== node.nodeType && 9 !== node.nodeType && 11 !== node.nodeType);
      }
      function getNearestMountedFiber(fiber) {
        for (var node = fiber, nextNode = node; nextNode && !nextNode.alternate; )
          node = nextNode, 0 !== (node.flags & 4098) && (fiber = node.return), nextNode = node.return;
        for (; node.return; ) node = node.return;
        return 3 === node.tag ? fiber : null;
      }
      function getSuspenseInstanceFromFiber(fiber) {
        if (13 === fiber.tag) {
          var suspenseState = fiber.memoizedState;
          null === suspenseState && (fiber = fiber.alternate, null !== fiber && (suspenseState = fiber.memoizedState));
          if (null !== suspenseState) return suspenseState.dehydrated;
        }
        return null;
      }
      function getActivityInstanceFromFiber(fiber) {
        if (31 === fiber.tag) {
          var activityState = fiber.memoizedState;
          null === activityState && (fiber = fiber.alternate, null !== fiber && (activityState = fiber.memoizedState));
          if (null !== activityState) return activityState.dehydrated;
        }
        return null;
      }
      function assertIsMounted(fiber) {
        if (getNearestMountedFiber(fiber) !== fiber)
          throw Error(formatProdErrorMessage(188));
      }
      function findCurrentFiberUsingSlowPath(fiber) {
        var alternate = fiber.alternate;
        if (!alternate) {
          alternate = getNearestMountedFiber(fiber);
          if (null === alternate) throw Error(formatProdErrorMessage(188));
          return alternate !== fiber ? null : fiber;
        }
        for (var a = fiber, b = alternate; ; ) {
          var parentA = a.return;
          if (null === parentA) break;
          var parentB = parentA.alternate;
          if (null === parentB) {
            b = parentA.return;
            if (null !== b) {
              a = b;
              continue;
            }
            break;
          }
          if (parentA.child === parentB.child) {
            for (parentB = parentA.child; parentB; ) {
              if (parentB === a) return assertIsMounted(parentA), fiber;
              if (parentB === b) return assertIsMounted(parentA), alternate;
              parentB = parentB.sibling;
            }
            throw Error(formatProdErrorMessage(188));
          }
          if (a.return !== b.return) a = parentA, b = parentB;
          else {
            for (var didFindChild = false, child$0 = parentA.child; child$0; ) {
              if (child$0 === a) {
                didFindChild = true;
                a = parentA;
                b = parentB;
                break;
              }
              if (child$0 === b) {
                didFindChild = true;
                b = parentA;
                a = parentB;
                break;
              }
              child$0 = child$0.sibling;
            }
            if (!didFindChild) {
              for (child$0 = parentB.child; child$0; ) {
                if (child$0 === a) {
                  didFindChild = true;
                  a = parentB;
                  b = parentA;
                  break;
                }
                if (child$0 === b) {
                  didFindChild = true;
                  b = parentB;
                  a = parentA;
                  break;
                }
                child$0 = child$0.sibling;
              }
              if (!didFindChild) throw Error(formatProdErrorMessage(189));
            }
          }
          if (a.alternate !== b) throw Error(formatProdErrorMessage(190));
        }
        if (3 !== a.tag) throw Error(formatProdErrorMessage(188));
        return a.stateNode.current === a ? fiber : alternate;
      }
      function findCurrentHostFiberImpl(node) {
        var tag = node.tag;
        if (5 === tag || 26 === tag || 27 === tag || 6 === tag) return node;
        for (node = node.child; null !== node; ) {
          tag = findCurrentHostFiberImpl(node);
          if (null !== tag) return tag;
          node = node.sibling;
        }
        return null;
      }
      function traverseVisibleInstancesAndTextInstances(child, searchWithinHosts, fn, a, b, c) {
        for (; null !== child; ) {
          if ((5 === child.tag || 27 === child.tag || 6 === child.tag) && fn(child, a, b, c) || (22 !== child.tag || null === child.memoizedState) && (searchWithinHosts || 5 !== child.tag && 27 !== child.tag) && traverseVisibleInstancesAndTextInstances(
            child.child,
            searchWithinHosts,
            fn,
            a,
            b,
            c
          ))
            return true;
          child = child.sibling;
        }
        return false;
      }
      function getFragmentParentInstanceOrContainerFiber(fiber) {
        for (fiber = fiber.return; null !== fiber; ) {
          if (3 === fiber.tag || 5 === fiber.tag || 27 === fiber.tag) return fiber;
          fiber = fiber.return;
        }
        return null;
      }
      function fiberIsPortaledIntoHost(fiber) {
        var foundPortalParent = false;
        for (fiber = fiber.return; null !== fiber; ) {
          4 === fiber.tag && (foundPortalParent = true);
          if (3 === fiber.tag || 5 === fiber.tag || 27 === fiber.tag) break;
          fiber = fiber.return;
        }
        return foundPortalParent;
      }
      function getFragmentInstanceOrTextInstanceSiblings(fiber) {
        var result = [null, null], parentHostFiber = getFragmentParentInstanceOrContainerFiber(fiber);
        if (null === parentHostFiber) return result;
        findFragmentInstanceOrTextInstanceSiblings(
          result,
          fiber,
          parentHostFiber.child,
          { foundSelf: false }
        );
        return result;
      }
      function findFragmentInstanceOrTextInstanceSiblings(result, self, child, state) {
        for (; null !== child; ) {
          if (child === self) state.foundSelf = true;
          else if (5 === child.tag || 27 === child.tag || 6 === child.tag) {
            if (state.foundSelf) return result[1] = child, true;
            result[0] = child;
          } else if ((22 !== child.tag || null === child.memoizedState) && findFragmentInstanceOrTextInstanceSiblings(
            result,
            self,
            child.child,
            state
          ))
            return true;
          child = child.sibling;
        }
        return false;
      }
      function getInstanceFromHostFiber(fiber) {
        switch (fiber.tag) {
          case 5:
          case 27:
          case 6:
            return fiber.stateNode;
          case 3:
            return fiber.stateNode.containerInfo;
          default:
            throw Error(formatProdErrorMessage(559));
        }
      }
      var searchTarget = null;
      var searchBoundary = null;
      function isFiberPrecedingCheck(child, target, boundary) {
        return child === boundary ? true : child === target ? (searchTarget = child, true) : false;
      }
      function isFiberFollowingCheck(child, target, boundary) {
        return child === boundary ? (searchBoundary = child, false) : child === target ? (null !== searchBoundary && (searchTarget = child), true) : false;
      }
      function getParentForFragmentAncestors(inst) {
        if (null === inst) return null;
        do
          inst = null === inst ? null : inst.return;
        while (inst && 5 !== inst.tag && 27 !== inst.tag && 3 !== inst.tag);
        return inst ? inst : null;
      }
      function getLowestCommonAncestor(instA, instB, getParent2) {
        for (var depthA = 0, tempA = instA; tempA; tempA = getParent2(tempA)) depthA++;
        tempA = 0;
        for (var tempB = instB; tempB; tempB = getParent2(tempB)) tempA++;
        for (; 0 < depthA - tempA; ) instA = getParent2(instA), depthA--;
        for (; 0 < tempA - depthA; ) instB = getParent2(instB), tempA--;
        for (; depthA--; ) {
          if (instA === instB || null !== instB && instA === instB.alternate)
            return instA;
          instA = getParent2(instA);
          instB = getParent2(instB);
        }
        return null;
      }
      var assign = Object.assign;
      var REACT_LEGACY_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.element");
      var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element");
      var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
      var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
      var REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode");
      var REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler");
      var REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer");
      var REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context");
      var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
      var REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense");
      var REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list");
      var REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo");
      var REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy");
      var REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity");
      var REACT_LEGACY_HIDDEN_TYPE = /* @__PURE__ */ Symbol.for("react.legacy_hidden");
      var REACT_MEMO_CACHE_SENTINEL = /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel");
      var REACT_VIEW_TRANSITION_TYPE = /* @__PURE__ */ Symbol.for("react.view_transition");
      var REACT_RECOVERABLE_TYPE = /* @__PURE__ */ Symbol.for("react.recoverable");
      var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
      function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
      }
      var REACT_CLIENT_REFERENCE = /* @__PURE__ */ Symbol.for("react.client.reference");
      function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type)
          return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch (type) {
          case REACT_FRAGMENT_TYPE:
            return "Fragment";
          case REACT_PROFILER_TYPE:
            return "Profiler";
          case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
          case REACT_SUSPENSE_TYPE:
            return "Suspense";
          case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
          case REACT_ACTIVITY_TYPE:
            return "Activity";
          case REACT_VIEW_TRANSITION_TYPE:
            return "ViewTransition";
        }
        if ("object" === typeof type)
          switch (type.$$typeof) {
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_CONTEXT_TYPE:
              return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
              return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
              var innerType = type.render;
              type = type.displayName;
              type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
              return type;
            case REACT_MEMO_TYPE:
              return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
              innerType = type._payload;
              type = type._init;
              try {
                return getComponentNameFromType(type(innerType));
              } catch (x) {
              }
          }
        return null;
      }
      var isArrayImpl = Array.isArray;
      var ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      var ReactDOMSharedInternals = ReactDOM.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      var sharedNotPendingObject = {
        pending: false,
        data: null,
        method: null,
        action: null
      };
      var valueStack = [];
      var index = -1;
      function createCursor(defaultValue) {
        return { current: defaultValue };
      }
      function pop(cursor) {
        0 > index || (cursor.current = valueStack[index], valueStack[index] = null, index--);
      }
      function push(cursor, value) {
        index++;
        valueStack[index] = cursor.current;
        cursor.current = value;
      }
      var contextStackCursor = createCursor(null);
      var contextFiberStackCursor = createCursor(null);
      var rootInstanceStackCursor = createCursor(null);
      var hostTransitionProviderCursor = createCursor(null);
      function pushHostContainer(fiber, nextRootInstance) {
        push(rootInstanceStackCursor, nextRootInstance);
        push(contextFiberStackCursor, fiber);
        push(contextStackCursor, null);
        switch (nextRootInstance.nodeType) {
          case 9:
          case 11:
            fiber = (fiber = nextRootInstance.documentElement) ? (fiber = fiber.namespaceURI) ? getOwnHostContext(fiber) : 0 : 0;
            break;
          default:
            if (fiber = nextRootInstance.tagName, nextRootInstance = nextRootInstance.namespaceURI)
              nextRootInstance = getOwnHostContext(nextRootInstance), fiber = getChildHostContextProd(nextRootInstance, fiber);
            else
              switch (fiber) {
                case "svg":
                  fiber = 1;
                  break;
                case "math":
                  fiber = 2;
                  break;
                default:
                  fiber = 0;
              }
        }
        pop(contextStackCursor);
        push(contextStackCursor, fiber);
      }
      function popHostContainer() {
        pop(contextStackCursor);
        pop(contextFiberStackCursor);
        pop(rootInstanceStackCursor);
      }
      function pushHostContext(fiber) {
        var stateHook = fiber.memoizedState;
        null !== stateHook && (HostTransitionContext._currentValue = stateHook.memoizedState, push(hostTransitionProviderCursor, fiber));
        stateHook = contextStackCursor.current;
        var JSCompiler_inline_result = getChildHostContextProd(stateHook, fiber.type);
        stateHook !== JSCompiler_inline_result && (push(contextFiberStackCursor, fiber), push(contextStackCursor, JSCompiler_inline_result));
      }
      function popHostContext(fiber) {
        contextFiberStackCursor.current === fiber && (pop(contextStackCursor), pop(contextFiberStackCursor));
        hostTransitionProviderCursor.current === fiber && (pop(hostTransitionProviderCursor), HostTransitionContext._currentValue = sharedNotPendingObject);
      }
      var prefix;
      var suffix;
      function describeBuiltInComponentFrame(name) {
        if (void 0 === prefix)
          try {
            throw Error();
          } catch (x) {
            var match = x.stack.trim().match(/\n( *(at )?)/);
            prefix = match && match[1] || "";
            suffix = -1 < x.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < x.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return "\n" + prefix + name + suffix;
      }
      var reentry = false;
      function describeNativeComponentFrame(fn, construct) {
        if (!fn || reentry) return "";
        reentry = true;
        var previousPrepareStackTrace = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var RunInRootFrame = {
            DetermineComponentFrameRoot: function() {
              try {
                if (construct) {
                  var Fake = function() {
                    throw Error();
                  };
                  Object.defineProperty(Fake.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  });
                  if ("object" === typeof Reflect && Reflect.construct) {
                    try {
                      Reflect.construct(Fake, []);
                    } catch (x) {
                      var control = x;
                    }
                    Reflect.construct(fn, [], Fake);
                  } else {
                    try {
                      Fake.call();
                    } catch (x$1) {
                      control = x$1;
                    }
                    Fake = false;
                    try {
                      var prevProps = Object.getOwnPropertyDescriptor(
                        fn.prototype,
                        "props"
                      );
                      Object.defineProperty(fn.prototype, "props", {
                        configurable: true,
                        set: function() {
                          throw Error();
                        }
                      });
                      Fake = true;
                      new fn();
                    } finally {
                      Fake && (void 0 !== prevProps ? Object.defineProperty(fn.prototype, "props", prevProps) : delete fn.prototype.props);
                    }
                  }
                } else {
                  try {
                    throw Error();
                  } catch (x$2) {
                    control = x$2;
                  }
                  (Fake = fn()) && "function" === typeof Fake.catch && Fake.catch(function() {
                  });
                }
              } catch (sample) {
                if (sample && control && "string" === typeof sample.stack)
                  return [sample.stack, control.stack];
              }
              return [null, null];
            }
          };
          RunInRootFrame.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
          var namePropDescriptor = Object.getOwnPropertyDescriptor(
            RunInRootFrame.DetermineComponentFrameRoot,
            "name"
          );
          namePropDescriptor && namePropDescriptor.configurable && Object.defineProperty(
            RunInRootFrame.DetermineComponentFrameRoot,
            "name",
            { value: "DetermineComponentFrameRoot" }
          );
          var _RunInRootFrame$Deter = RunInRootFrame.DetermineComponentFrameRoot(), sampleStack = _RunInRootFrame$Deter[0], controlStack = _RunInRootFrame$Deter[1];
          if (sampleStack && controlStack) {
            var sampleLines = sampleStack.split("\n"), controlLines = controlStack.split("\n");
            for (namePropDescriptor = RunInRootFrame = 0; RunInRootFrame < sampleLines.length && !sampleLines[RunInRootFrame].includes("DetermineComponentFrameRoot"); )
              RunInRootFrame++;
            for (; namePropDescriptor < controlLines.length && !controlLines[namePropDescriptor].includes(
              "DetermineComponentFrameRoot"
            ); )
              namePropDescriptor++;
            if (RunInRootFrame === sampleLines.length || namePropDescriptor === controlLines.length)
              for (RunInRootFrame = sampleLines.length - 1, namePropDescriptor = controlLines.length - 1; 1 <= RunInRootFrame && 0 <= namePropDescriptor && sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]; )
                namePropDescriptor--;
            for (; 1 <= RunInRootFrame && 0 <= namePropDescriptor; RunInRootFrame--, namePropDescriptor--)
              if (sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]) {
                if (1 !== RunInRootFrame || 1 !== namePropDescriptor) {
                  do
                    if (RunInRootFrame--, namePropDescriptor--, 0 > namePropDescriptor || sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]) {
                      var frame = "\n" + sampleLines[RunInRootFrame].replace(" at new ", " at ");
                      fn.displayName && frame.includes("<anonymous>") && (frame = frame.replace("<anonymous>", fn.displayName));
                      return frame;
                    }
                  while (1 <= RunInRootFrame && 0 <= namePropDescriptor);
                }
                break;
              }
          }
        } finally {
          reentry = false, Error.prepareStackTrace = previousPrepareStackTrace;
        }
        return (previousPrepareStackTrace = fn ? fn.displayName || fn.name : "") ? describeBuiltInComponentFrame(previousPrepareStackTrace) : "";
      }
      function describeFiber(fiber, childFiber) {
        switch (fiber.tag) {
          case 26:
          case 27:
          case 5:
            return describeBuiltInComponentFrame(fiber.type);
          case 16:
            return describeBuiltInComponentFrame("Lazy");
          case 13:
            return fiber.child !== childFiber && null !== childFiber ? describeBuiltInComponentFrame("Suspense Fallback") : describeBuiltInComponentFrame("Suspense");
          case 19:
            return describeBuiltInComponentFrame("SuspenseList");
          case 0:
          case 15:
            return describeNativeComponentFrame(fiber.type, false);
          case 11:
            return describeNativeComponentFrame(fiber.type.render, false);
          case 1:
            return describeNativeComponentFrame(fiber.type, true);
          case 31:
            return describeBuiltInComponentFrame("Activity");
          case 30:
            return describeBuiltInComponentFrame("ViewTransition");
          default:
            return "";
        }
      }
      function getStackByFiberInDevAndProd(workInProgress2) {
        try {
          var info = "", previous = null;
          do
            info += describeFiber(workInProgress2, previous), previous = workInProgress2, workInProgress2 = workInProgress2.return;
          while (workInProgress2);
          return info;
        } catch (x) {
          return "\nError generating stack: " + x.message + "\n" + x.stack;
        }
      }
      var hasOwnProperty = Object.prototype.hasOwnProperty;
      var scheduleCallback$3 = Scheduler.unstable_scheduleCallback;
      var cancelCallback$1 = Scheduler.unstable_cancelCallback;
      var shouldYield = Scheduler.unstable_shouldYield;
      var requestPaint = Scheduler.unstable_requestPaint;
      var now = Scheduler.unstable_now;
      var getCurrentPriorityLevel = Scheduler.unstable_getCurrentPriorityLevel;
      var ImmediatePriority = Scheduler.unstable_ImmediatePriority;
      var UserBlockingPriority = Scheduler.unstable_UserBlockingPriority;
      var NormalPriority$1 = Scheduler.unstable_NormalPriority;
      var LowPriority = Scheduler.unstable_LowPriority;
      var IdlePriority = Scheduler.unstable_IdlePriority;
      var log$1 = Scheduler.log;
      var unstable_setDisableYieldValue = Scheduler.unstable_setDisableYieldValue;
      var rendererID = null;
      var injectedHook = null;
      function setIsStrictModeForDevtools(newIsStrictMode) {
        "function" === typeof log$1 && unstable_setDisableYieldValue(newIsStrictMode);
        if (injectedHook && "function" === typeof injectedHook.setStrictMode)
          try {
            injectedHook.setStrictMode(rendererID, newIsStrictMode);
          } catch (err) {
          }
      }
      var clz32 = Math.clz32 ? Math.clz32 : clz32Fallback;
      var log = Math.log;
      var LN2 = Math.LN2;
      function clz32Fallback(x) {
        x >>>= 0;
        return 0 === x ? 32 : 31 - (log(x) / LN2 | 0) | 0;
      }
      var nextTransitionUpdateLane = 256;
      var nextTransitionDeferredLane = 262144;
      var nextRetryLane = 4194304;
      function getHighestPriorityLanes(lanes) {
        var pendingSyncLanes = lanes & 42;
        if (0 !== pendingSyncLanes) return pendingSyncLanes;
        switch (lanes & -lanes) {
          case 1:
            return 1;
          case 2:
            return 2;
          case 4:
            return 4;
          case 8:
            return 8;
          case 16:
            return 16;
          case 32:
            return 32;
          case 64:
            return 64;
          case 128:
            return 128;
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
            return lanes & -lanes;
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return lanes & 3932160;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            return lanes & 62914560;
          case 67108864:
            return 67108864;
          case 134217728:
            return 134217728;
          case 268435456:
            return 268435456;
          case 536870912:
            return 536870912;
          case 1073741824:
            return 0;
          default:
            return lanes;
        }
      }
      function getNextLanes(root2, wipLanes, rootHasPendingCommit) {
        var pendingLanes = root2.pendingLanes;
        if (0 === pendingLanes) return 0;
        var nextLanes = 0, suspendedLanes = root2.suspendedLanes, pingedLanes = root2.pingedLanes;
        root2 = root2.warmLanes;
        var nonIdlePendingLanes = pendingLanes & 134217727;
        0 !== nonIdlePendingLanes ? (pendingLanes = nonIdlePendingLanes & ~suspendedLanes, 0 !== pendingLanes ? nextLanes = getHighestPriorityLanes(pendingLanes) : (pingedLanes &= nonIdlePendingLanes, 0 !== pingedLanes ? nextLanes = getHighestPriorityLanes(pingedLanes) : rootHasPendingCommit || (rootHasPendingCommit = nonIdlePendingLanes & ~root2, 0 !== rootHasPendingCommit && (nextLanes = getHighestPriorityLanes(rootHasPendingCommit))))) : (nonIdlePendingLanes = pendingLanes & ~suspendedLanes, 0 !== nonIdlePendingLanes ? nextLanes = getHighestPriorityLanes(nonIdlePendingLanes) : 0 !== pingedLanes ? nextLanes = getHighestPriorityLanes(pingedLanes) : rootHasPendingCommit || (rootHasPendingCommit = pendingLanes & ~root2, 0 !== rootHasPendingCommit && (nextLanes = getHighestPriorityLanes(rootHasPendingCommit))));
        return 0 === nextLanes ? 0 : 0 !== wipLanes && wipLanes !== nextLanes && 0 === (wipLanes & suspendedLanes) && (suspendedLanes = nextLanes & -nextLanes, rootHasPendingCommit = wipLanes & -wipLanes, suspendedLanes >= rootHasPendingCommit || 32 === suspendedLanes && 0 !== (rootHasPendingCommit & 4194048)) ? wipLanes : nextLanes;
      }
      function checkIfRootIsPrerendering(root2, renderLanes2) {
        return 0 === (root2.pendingLanes & ~(root2.suspendedLanes & ~root2.pingedLanes) & renderLanes2);
      }
      function getEntangledLanes(root2, renderLanes2) {
        0 !== (renderLanes2 & 8) && (renderLanes2 |= renderLanes2 & 32);
        var allEntangledLanes = root2.entangledLanes;
        if (0 !== allEntangledLanes)
          for (root2 = root2.entanglements, allEntangledLanes &= renderLanes2; 0 < allEntangledLanes; ) {
            var index$4 = 31 - clz32(allEntangledLanes), lane = 1 << index$4;
            renderLanes2 |= root2[index$4];
            allEntangledLanes &= ~lane;
          }
        return renderLanes2;
      }
      function computeExpirationTime(lane, currentTime) {
        switch (lane) {
          case 1:
          case 2:
          case 4:
          case 8:
          case 64:
            return currentTime + 250;
          case 16:
          case 32:
          case 128:
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return currentTime + 5e3;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            return -1;
          case 67108864:
          case 134217728:
          case 268435456:
          case 536870912:
          case 1073741824:
            return -1;
          default:
            return -1;
        }
      }
      function claimNextRetryLane() {
        var lane = nextRetryLane;
        nextRetryLane <<= 1;
        0 === (nextRetryLane & 62914560) && (nextRetryLane = 4194304);
        return lane;
      }
      function createLaneMap(initial) {
        for (var laneMap = [], i = 0; 31 > i; i++) laneMap.push(initial);
        return laneMap;
      }
      function markRootUpdated$1(root2, updateLane) {
        root2.pendingLanes |= updateLane;
        268435456 !== updateLane && (root2.suspendedLanes = 0, root2.pingedLanes = 0, root2.warmLanes = 0);
      }
      function markRootFinished(root2, finishedLanes, remainingLanes, spawnedLane, updatedLanes, suspendedRetryLanes) {
        var previouslyPendingLanes = root2.pendingLanes;
        root2.pendingLanes = remainingLanes;
        root2.suspendedLanes = 0;
        root2.pingedLanes = 0;
        root2.warmLanes = 0;
        root2.expiredLanes &= remainingLanes;
        root2.entangledLanes &= remainingLanes;
        root2.errorRecoveryDisabledLanes &= remainingLanes;
        root2.shellSuspendCounter = 0;
        var entanglements = root2.entanglements, expirationTimes = root2.expirationTimes, hiddenUpdates = root2.hiddenUpdates;
        for (remainingLanes = previouslyPendingLanes & ~remainingLanes; 0 < remainingLanes; ) {
          var index$7 = 31 - clz32(remainingLanes), lane = 1 << index$7;
          entanglements[index$7] = 0;
          expirationTimes[index$7] = -1;
          var hiddenUpdatesForLane = hiddenUpdates[index$7];
          if (null !== hiddenUpdatesForLane)
            for (hiddenUpdates[index$7] = null, index$7 = 0; index$7 < hiddenUpdatesForLane.length; index$7++) {
              var update = hiddenUpdatesForLane[index$7];
              null !== update && (update.lane &= -536870913);
            }
          remainingLanes &= ~lane;
        }
        0 !== spawnedLane && markSpawnedDeferredLane(root2, spawnedLane, 0);
        0 !== suspendedRetryLanes && 0 === updatedLanes && 0 !== root2.tag && (root2.suspendedLanes |= suspendedRetryLanes & ~(previouslyPendingLanes & ~finishedLanes));
      }
      function markSpawnedDeferredLane(root2, spawnedLane, entangledLanes) {
        root2.pendingLanes |= spawnedLane;
        root2.suspendedLanes &= ~spawnedLane;
        var spawnedLaneIndex = 31 - clz32(spawnedLane);
        root2.entangledLanes |= spawnedLane;
        root2.entanglements[spawnedLaneIndex] = root2.entanglements[spawnedLaneIndex] | 1073741824 | entangledLanes & 261930;
      }
      function markRootEntangled(root2, entangledLanes) {
        var rootEntangledLanes = root2.entangledLanes |= entangledLanes;
        for (root2 = root2.entanglements; rootEntangledLanes; ) {
          var index$8 = 31 - clz32(rootEntangledLanes), lane = 1 << index$8;
          lane & entangledLanes | root2[index$8] & entangledLanes && (root2[index$8] |= entangledLanes);
          rootEntangledLanes &= ~lane;
        }
      }
      function getBumpedLaneForHydration(root2, renderLanes2) {
        var renderLane = renderLanes2 & -renderLanes2;
        renderLane = 0 !== (renderLane & 42) ? 1 : getBumpedLaneForHydrationByLane(renderLane);
        return 0 !== (renderLane & (root2.suspendedLanes | renderLanes2)) ? 0 : renderLane;
      }
      function getBumpedLaneForHydrationByLane(lane) {
        switch (lane) {
          case 2:
            lane = 1;
            break;
          case 8:
            lane = 4;
            break;
          case 32:
            lane = 16;
            break;
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            lane = 128;
            break;
          case 268435456:
            lane = 134217728;
            break;
          default:
            lane = 0;
        }
        return lane;
      }
      function lanesToEventPriority(lanes) {
        lanes &= -lanes;
        return 2 < lanes ? 8 < lanes ? 0 !== (lanes & 134217727) ? 32 : 268435456 : 8 : 2;
      }
      function resolveUpdatePriority() {
        var updatePriority = ReactDOMSharedInternals.p;
        if (0 !== updatePriority) return updatePriority;
        updatePriority = window.event;
        return void 0 === updatePriority ? 32 : getEventPriority(updatePriority.type);
      }
      function runWithPriority(priority, fn) {
        var previousPriority = ReactDOMSharedInternals.p;
        try {
          return ReactDOMSharedInternals.p = priority, fn();
        } finally {
          ReactDOMSharedInternals.p = previousPriority;
        }
      }
      var randomKey = Math.random().toString(36).slice(2);
      var internalInstanceKey = "__reactFiber$" + randomKey;
      var internalPropsKey = "__reactProps$" + randomKey;
      var internalContainerInstanceKey = "__reactContainer$" + randomKey;
      var internalEventHandlersKey = "__reactEvents$" + randomKey;
      var internalEventHandlerListenersKey = "__reactListeners$" + randomKey;
      var internalEventHandlesSetKey = "__reactHandles$" + randomKey;
      var internalRootNodeResourcesKey = "__reactResources$" + randomKey;
      var internalHoistableMarker = "__reactMarker$" + randomKey;
      var internalLoadPendingKey = "__reactLoad$" + randomKey;
      function detachDeletedInstance(node) {
        delete node[internalInstanceKey];
        delete node[internalPropsKey];
        delete node[internalEventHandlerListenersKey];
        delete node[internalEventHandlesSetKey];
      }
      function getClosestInstanceFromNode(targetNode) {
        var targetInst;
        if (targetInst = targetNode[internalInstanceKey]) return targetInst;
        for (var parentNode = targetNode.parentNode; parentNode; ) {
          if (targetInst = parentNode[internalContainerInstanceKey] || parentNode[internalInstanceKey]) {
            parentNode = targetInst.alternate;
            if (null !== targetInst.child || null !== parentNode && null !== parentNode.child)
              for (targetNode = getParentHydrationBoundary(targetNode); null !== targetNode; ) {
                if (parentNode = targetNode[internalInstanceKey]) return parentNode;
                targetNode = getParentHydrationBoundary(targetNode);
              }
            return targetInst;
          }
          targetNode = parentNode;
          parentNode = targetNode.parentNode;
        }
        return null;
      }
      function getInstanceFromNode(node) {
        if (node = node[internalInstanceKey] || node[internalContainerInstanceKey]) {
          var tag = node.tag;
          if (5 === tag || 6 === tag || 13 === tag || 31 === tag || 26 === tag || 27 === tag || 3 === tag)
            return node;
        }
        return null;
      }
      function getNodeFromInstance(inst) {
        var tag = inst.tag;
        if (5 === tag || 26 === tag || 27 === tag || 6 === tag) return inst.stateNode;
        throw Error(formatProdErrorMessage(33));
      }
      function getResourcesFromRoot(root2) {
        var resources = root2[internalRootNodeResourcesKey];
        resources || (resources = root2[internalRootNodeResourcesKey] = { hoistableStyles: /* @__PURE__ */ new Map(), hoistableScripts: /* @__PURE__ */ new Map() });
        return resources;
      }
      function markNodeAsHoistable(node) {
        node[internalHoistableMarker] = true;
      }
      function clearPendingLoadOnNode(node) {
        node[internalLoadPendingKey] = void 0;
      }
      var allNativeEvents = /* @__PURE__ */ new Set();
      var registrationNameDependencies = {};
      function registerTwoPhaseEvent(registrationName, dependencies) {
        registerDirectEvent(registrationName, dependencies);
        registerDirectEvent(registrationName + "Capture", dependencies);
      }
      function registerDirectEvent(registrationName, dependencies) {
        registrationNameDependencies[registrationName] = dependencies;
        for (registrationName = 0; registrationName < dependencies.length; registrationName++)
          allNativeEvents.add(dependencies[registrationName]);
      }
      var VALID_ATTRIBUTE_NAME_REGEX = RegExp(
        "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
      );
      var illegalAttributeNameCache = {};
      var validatedAttributeNameCache = {};
      function isAttributeNameSafe(attributeName) {
        if (hasOwnProperty.call(validatedAttributeNameCache, attributeName))
          return true;
        if (hasOwnProperty.call(illegalAttributeNameCache, attributeName)) return false;
        if (VALID_ATTRIBUTE_NAME_REGEX.test(attributeName))
          return validatedAttributeNameCache[attributeName] = true;
        illegalAttributeNameCache[attributeName] = true;
        return false;
      }
      var viewTransitionMutationContext = false;
      function pushMutationContext() {
        var prev = viewTransitionMutationContext;
        viewTransitionMutationContext = false;
        return prev;
      }
      function setValueForAttribute(node, name, value) {
        if (isAttributeNameSafe(name))
          if (null === value) node.removeAttribute(name);
          else {
            switch (typeof value) {
              case "undefined":
              case "function":
              case "symbol":
                node.removeAttribute(name);
                return;
              case "boolean":
                var prefix$10 = name.toLowerCase().slice(0, 5);
                if ("data-" !== prefix$10 && "aria-" !== prefix$10) {
                  node.removeAttribute(name);
                  return;
                }
            }
            node.setAttribute(name, value);
          }
      }
      function setValueForKnownAttribute(node, name, value) {
        if (null === value) node.removeAttribute(name);
        else {
          switch (typeof value) {
            case "undefined":
            case "function":
            case "symbol":
            case "boolean":
              node.removeAttribute(name);
              return;
          }
          node.setAttribute(name, value);
        }
      }
      function setValueForNamespacedAttribute(node, namespace, name, value) {
        if (null === value) node.removeAttribute(name);
        else {
          switch (typeof value) {
            case "undefined":
            case "function":
            case "symbol":
            case "boolean":
              node.removeAttribute(name);
              return;
          }
          node.setAttributeNS(namespace, name, value);
        }
      }
      function getToStringValue(value) {
        switch (typeof value) {
          case "bigint":
          case "boolean":
          case "number":
          case "string":
          case "undefined":
            return value;
          case "object":
            return value;
          default:
            return "";
        }
      }
      function isCheckable(elem) {
        var type = elem.type;
        return (elem = elem.nodeName) && "input" === elem.toLowerCase() && ("checkbox" === type || "radio" === type);
      }
      function trackValueOnNode(node, valueField, currentValue) {
        var descriptor = Object.getOwnPropertyDescriptor(
          node.constructor.prototype,
          valueField
        );
        if (!node.hasOwnProperty(valueField) && "undefined" !== typeof descriptor && "function" === typeof descriptor.get && "function" === typeof descriptor.set) {
          var get = descriptor.get, set = descriptor.set;
          Object.defineProperty(node, valueField, {
            configurable: true,
            get: function() {
              return get.call(this);
            },
            set: function(value) {
              currentValue = "" + value;
              set.call(this, value);
            }
          });
          Object.defineProperty(node, valueField, {
            enumerable: descriptor.enumerable
          });
          return {
            getValue: function() {
              return currentValue;
            },
            setValue: function(value) {
              currentValue = "" + value;
            },
            stopTracking: function() {
              node._valueTracker = null;
              delete node[valueField];
            }
          };
        }
      }
      function track(node) {
        if (!node._valueTracker) {
          var valueField = isCheckable(node) ? "checked" : "value";
          node._valueTracker = trackValueOnNode(
            node,
            valueField,
            "" + node[valueField]
          );
        }
      }
      function updateValueIfChanged(node) {
        if (!node) return false;
        var tracker = node._valueTracker;
        if (!tracker) return true;
        var lastValue = tracker.getValue();
        var value = "";
        node && (value = isCheckable(node) ? node.checked ? "true" : "false" : node.value);
        node = value;
        return node !== lastValue ? (tracker.setValue(node), true) : false;
      }
      var escapeSelectorAttributeValueInsideDoubleQuotesRegex = /[\n"\\]/g;
      function escapeSelectorAttributeValueInsideDoubleQuotes(value) {
        return value.replace(
          escapeSelectorAttributeValueInsideDoubleQuotesRegex,
          function(ch) {
            return "\\" + ch.charCodeAt(0).toString(16) + " ";
          }
        );
      }
      function updateInput(element, value, defaultValue, lastDefaultValue, checked, defaultChecked, type, name) {
        element.name = "";
        null != type && "function" !== typeof type && "symbol" !== typeof type && "boolean" !== typeof type ? element.type = type : element.removeAttribute("type");
        if (null != value)
          if ("number" === type) {
            if (0 === value && "" === element.value || element.value != value)
              element.value = "" + getToStringValue(value);
          } else
            element.value !== "" + getToStringValue(value) && (element.value = "" + getToStringValue(value));
        else
          "submit" !== type && "reset" !== type || element.removeAttribute("value");
        null != value ? "number" === type && element.value == value ? setDefaultValue(element, getToStringValue(element.value)) : setDefaultValue(element, getToStringValue(value)) : null != defaultValue ? setDefaultValue(element, getToStringValue(defaultValue)) : null != lastDefaultValue && element.removeAttribute("value");
        null == checked && null != defaultChecked && (element.defaultChecked = !!defaultChecked);
        null != checked && (element.checked = checked && "function" !== typeof checked && "symbol" !== typeof checked);
        null != name && "function" !== typeof name && "symbol" !== typeof name && "boolean" !== typeof name ? element.name = "" + getToStringValue(name) : element.removeAttribute("name");
      }
      function initInput(element, value, defaultValue, checked, defaultChecked, type, name, isHydrating2) {
        null != type && "function" !== typeof type && "symbol" !== typeof type && "boolean" !== typeof type && (element.type = type);
        if (null != value || null != defaultValue) {
          if (!("submit" !== type && "reset" !== type || void 0 !== value && null !== value)) {
            track(element);
            return;
          }
          defaultValue = null != defaultValue ? "" + getToStringValue(defaultValue) : "";
          value = null != value ? "" + getToStringValue(value) : defaultValue;
          isHydrating2 || value === element.value || (element.value = value);
          element.defaultValue = value;
        }
        checked = null != checked ? checked : defaultChecked;
        checked = "function" !== typeof checked && "symbol" !== typeof checked && !!checked;
        element.checked = isHydrating2 ? element.checked : !!checked;
        element.defaultChecked = !!checked;
        null != name && "function" !== typeof name && "symbol" !== typeof name && "boolean" !== typeof name && (element.name = name);
        track(element);
      }
      function setDefaultValue(node, value) {
        node.defaultValue !== "" + value && (node.defaultValue = "" + value);
      }
      function updateOptions(node, multiple, propValue, setDefaultSelected) {
        node = node.options;
        if (multiple) {
          multiple = {};
          for (var i = 0; i < propValue.length; i++)
            multiple["$" + propValue[i]] = true;
          for (propValue = 0; propValue < node.length; propValue++)
            i = multiple.hasOwnProperty("$" + node[propValue].value), node[propValue].selected !== i && (node[propValue].selected = i), i && setDefaultSelected && (node[propValue].defaultSelected = true);
        } else {
          propValue = "" + getToStringValue(propValue);
          multiple = null;
          for (i = 0; i < node.length; i++) {
            if (node[i].value === propValue) {
              node[i].selected = true;
              setDefaultSelected && (node[i].defaultSelected = true);
              return;
            }
            null !== multiple || node[i].disabled || (multiple = node[i]);
          }
          null !== multiple && (multiple.selected = true);
        }
      }
      function updateTextarea(element, value, defaultValue) {
        if (null != value && (value = "" + getToStringValue(value), value !== element.value && (element.value = value), null == defaultValue)) {
          element.defaultValue !== value && (element.defaultValue = value);
          return;
        }
        element.defaultValue = null != defaultValue ? "" + getToStringValue(defaultValue) : "";
      }
      function initTextarea(element, value, defaultValue, children) {
        if (null == value) {
          if (null != children) {
            if (null != defaultValue) throw Error(formatProdErrorMessage(92));
            if (isArrayImpl(children)) {
              if (1 < children.length) throw Error(formatProdErrorMessage(93));
              children = children[0];
            }
            defaultValue = children;
          }
          null == defaultValue && (defaultValue = "");
          value = defaultValue;
        }
        defaultValue = getToStringValue(value);
        element.defaultValue = defaultValue;
        children = element.textContent;
        children === defaultValue && "" !== children && null !== children && (element.value = children);
        track(element);
      }
      function setTextContent(node, text) {
        if (text) {
          var firstChild = node.firstChild;
          if (firstChild && firstChild === node.lastChild && 3 === firstChild.nodeType) {
            firstChild.nodeValue = text;
            return;
          }
        }
        node.textContent = text;
      }
      var unitlessNumbers = new Set(
        "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
          " "
        )
      );
      function setValueForStyle(style2, styleName, value) {
        var isCustomProperty = 0 === styleName.indexOf("--");
        null == value || "boolean" === typeof value || "" === value ? isCustomProperty ? style2.setProperty(styleName, "") : "float" === styleName ? style2.cssFloat = "" : style2[styleName] = "" : isCustomProperty ? style2.setProperty(styleName, value) : "number" !== typeof value || 0 === value || unitlessNumbers.has(styleName) ? "float" === styleName ? style2.cssFloat = value : style2[styleName] = ("" + value).trim() : style2[styleName] = value + "px";
      }
      function setValueForStyles(node, styles, prevStyles) {
        if (null != styles && "object" !== typeof styles)
          throw Error(formatProdErrorMessage(62));
        node = node.style;
        if (null != prevStyles) {
          for (var styleName in prevStyles)
            !prevStyles.hasOwnProperty(styleName) || null != styles && styles.hasOwnProperty(styleName) || (0 === styleName.indexOf("--") ? node.setProperty(styleName, "") : "float" === styleName ? node.cssFloat = "" : node[styleName] = "", viewTransitionMutationContext = true);
          for (var styleName$16 in styles)
            styleName = styles[styleName$16], styles.hasOwnProperty(styleName$16) && prevStyles[styleName$16] !== styleName && (setValueForStyle(node, styleName$16, styleName), viewTransitionMutationContext = true);
        } else
          for (var styleName$17 in styles)
            styles.hasOwnProperty(styleName$17) && setValueForStyle(node, styleName$17, styles[styleName$17]);
      }
      function isCustomElement(tagName) {
        if (-1 === tagName.indexOf("-")) return false;
        switch (tagName) {
          case "annotation-xml":
          case "color-profile":
          case "font-face":
          case "font-face-src":
          case "font-face-uri":
          case "font-face-format":
          case "font-face-name":
          case "missing-glyph":
            return false;
          default:
            return true;
        }
      }
      var aliases = /* @__PURE__ */ new Map([
        ["acceptCharset", "accept-charset"],
        ["htmlFor", "for"],
        ["httpEquiv", "http-equiv"],
        ["crossOrigin", "crossorigin"],
        ["accentHeight", "accent-height"],
        ["alignmentBaseline", "alignment-baseline"],
        ["arabicForm", "arabic-form"],
        ["baselineShift", "baseline-shift"],
        ["capHeight", "cap-height"],
        ["clipPath", "clip-path"],
        ["clipRule", "clip-rule"],
        ["colorInterpolation", "color-interpolation"],
        ["colorInterpolationFilters", "color-interpolation-filters"],
        ["colorProfile", "color-profile"],
        ["colorRendering", "color-rendering"],
        ["dominantBaseline", "dominant-baseline"],
        ["enableBackground", "enable-background"],
        ["fillOpacity", "fill-opacity"],
        ["fillRule", "fill-rule"],
        ["floodColor", "flood-color"],
        ["floodOpacity", "flood-opacity"],
        ["fontFamily", "font-family"],
        ["fontSize", "font-size"],
        ["fontSizeAdjust", "font-size-adjust"],
        ["fontStretch", "font-stretch"],
        ["fontStyle", "font-style"],
        ["fontVariant", "font-variant"],
        ["fontWeight", "font-weight"],
        ["glyphName", "glyph-name"],
        ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
        ["glyphOrientationVertical", "glyph-orientation-vertical"],
        ["horizAdvX", "horiz-adv-x"],
        ["horizOriginX", "horiz-origin-x"],
        ["imageRendering", "image-rendering"],
        ["letterSpacing", "letter-spacing"],
        ["lightingColor", "lighting-color"],
        ["markerEnd", "marker-end"],
        ["markerMid", "marker-mid"],
        ["markerStart", "marker-start"],
        ["maskType", "mask-type"],
        ["overlinePosition", "overline-position"],
        ["overlineThickness", "overline-thickness"],
        ["paintOrder", "paint-order"],
        ["panose-1", "panose-1"],
        ["pointerEvents", "pointer-events"],
        ["renderingIntent", "rendering-intent"],
        ["shapeRendering", "shape-rendering"],
        ["stopColor", "stop-color"],
        ["stopOpacity", "stop-opacity"],
        ["strikethroughPosition", "strikethrough-position"],
        ["strikethroughThickness", "strikethrough-thickness"],
        ["strokeDasharray", "stroke-dasharray"],
        ["strokeDashoffset", "stroke-dashoffset"],
        ["strokeLinecap", "stroke-linecap"],
        ["strokeLinejoin", "stroke-linejoin"],
        ["strokeMiterlimit", "stroke-miterlimit"],
        ["strokeOpacity", "stroke-opacity"],
        ["strokeWidth", "stroke-width"],
        ["textAnchor", "text-anchor"],
        ["textDecoration", "text-decoration"],
        ["textRendering", "text-rendering"],
        ["transformOrigin", "transform-origin"],
        ["underlinePosition", "underline-position"],
        ["underlineThickness", "underline-thickness"],
        ["unicodeBidi", "unicode-bidi"],
        ["unicodeRange", "unicode-range"],
        ["unitsPerEm", "units-per-em"],
        ["vAlphabetic", "v-alphabetic"],
        ["vHanging", "v-hanging"],
        ["vIdeographic", "v-ideographic"],
        ["vMathematical", "v-mathematical"],
        ["vectorEffect", "vector-effect"],
        ["vertAdvY", "vert-adv-y"],
        ["vertOriginX", "vert-origin-x"],
        ["vertOriginY", "vert-origin-y"],
        ["wordSpacing", "word-spacing"],
        ["writingMode", "writing-mode"],
        ["xmlnsXlink", "xmlns:xlink"],
        ["xHeight", "x-height"]
      ]);
      var isJavaScriptProtocol = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
      function sanitizeURL(url) {
        return isJavaScriptProtocol.test("" + url) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : url;
      }
      function noop$1() {
      }
      var currentReplayingEvent = null;
      function getEventTarget(nativeEvent) {
        nativeEvent = nativeEvent.target || nativeEvent.srcElement || window;
        nativeEvent.correspondingUseElement && (nativeEvent = nativeEvent.correspondingUseElement);
        return 3 === nativeEvent.nodeType ? nativeEvent.parentNode : nativeEvent;
      }
      var restoreTarget = null;
      var restoreQueue = null;
      function restoreStateOfTarget(target) {
        var internalInstance = getInstanceFromNode(target);
        if (internalInstance && (target = internalInstance.stateNode)) {
          var props = target[internalPropsKey] || null;
          a: switch (target = internalInstance.stateNode, internalInstance.type) {
            case "input":
              updateInput(
                target,
                props.value,
                props.defaultValue,
                props.defaultValue,
                props.checked,
                props.defaultChecked,
                props.type,
                props.name
              );
              internalInstance = props.name;
              if ("radio" === props.type && null != internalInstance) {
                for (props = target; props.parentNode; ) props = props.parentNode;
                props = props.querySelectorAll(
                  'input[name="' + escapeSelectorAttributeValueInsideDoubleQuotes(
                    "" + internalInstance
                  ) + '"][type="radio"]'
                );
                for (internalInstance = 0; internalInstance < props.length; internalInstance++) {
                  var otherNode = props[internalInstance];
                  if (otherNode !== target && otherNode.form === target.form) {
                    var otherProps = otherNode[internalPropsKey] || null;
                    if (!otherProps) throw Error(formatProdErrorMessage(90));
                    updateInput(
                      otherNode,
                      otherProps.value,
                      otherProps.defaultValue,
                      otherProps.defaultValue,
                      otherProps.checked,
                      otherProps.defaultChecked,
                      otherProps.type,
                      otherProps.name
                    );
                  }
                }
                for (internalInstance = 0; internalInstance < props.length; internalInstance++)
                  otherNode = props[internalInstance], otherNode.form === target.form && updateValueIfChanged(otherNode);
              }
              break a;
            case "textarea":
              updateTextarea(target, props.value, props.defaultValue);
              break a;
            case "select":
              internalInstance = props.value, null != internalInstance && updateOptions(target, !!props.multiple, internalInstance, false);
          }
        }
      }
      var isInsideEventHandler = false;
      function batchedUpdates$1(fn, a, b) {
        if (isInsideEventHandler) return fn(a, b);
        isInsideEventHandler = true;
        try {
          var JSCompiler_inline_result = fn(a);
          return JSCompiler_inline_result;
        } finally {
          if (isInsideEventHandler = false, null !== restoreTarget || null !== restoreQueue) {
            if (flushSyncWork$1(), restoreTarget && (a = restoreTarget, fn = restoreQueue, restoreQueue = restoreTarget = null, restoreStateOfTarget(a), fn))
              for (a = 0; a < fn.length; a++) restoreStateOfTarget(fn[a]);
          }
        }
      }
      function getListener(inst, registrationName) {
        var stateNode = inst.stateNode;
        if (null === stateNode) return null;
        var props = stateNode[internalPropsKey] || null;
        if (null === props) return null;
        stateNode = props[registrationName];
        a: switch (registrationName) {
          case "onClick":
          case "onClickCapture":
          case "onDoubleClick":
          case "onDoubleClickCapture":
          case "onMouseDown":
          case "onMouseDownCapture":
          case "onMouseMove":
          case "onMouseMoveCapture":
          case "onMouseUp":
          case "onMouseUpCapture":
          case "onMouseEnter":
            (props = !props.disabled) || (inst = inst.type, props = !("button" === inst || "input" === inst || "select" === inst || "textarea" === inst));
            inst = !props;
            break a;
          default:
            inst = false;
        }
        if (inst) return null;
        if (stateNode && "function" !== typeof stateNode)
          throw Error(
            formatProdErrorMessage(231, registrationName, typeof stateNode)
          );
        return stateNode;
      }
      var canUseDOM = !("undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement);
      var passiveBrowserEventsSupported = false;
      if (canUseDOM)
        try {
          options = {};
          Object.defineProperty(options, "passive", {
            get: function() {
              passiveBrowserEventsSupported = true;
            }
          });
          window.addEventListener("test", options, options);
          window.removeEventListener("test", options, options);
        } catch (e) {
          passiveBrowserEventsSupported = false;
        }
      var options;
      var root = null;
      var startText = null;
      var fallbackText = null;
      function getData() {
        if (fallbackText) return fallbackText;
        var start, startValue = startText, startLength = startValue.length, end, endValue = "value" in root ? root.value : root.textContent, endLength = endValue.length;
        for (start = 0; start < startLength && startValue[start] === endValue[start]; start++) ;
        var minEnd = startLength - start;
        for (end = 1; end <= minEnd && startValue[startLength - end] === endValue[endLength - end]; end++) ;
        return fallbackText = endValue.slice(start, 1 < end ? 1 - end : void 0);
      }
      function getEventCharCode(nativeEvent) {
        var keyCode = nativeEvent.keyCode;
        "charCode" in nativeEvent ? (nativeEvent = nativeEvent.charCode, 0 === nativeEvent && 13 === keyCode && (nativeEvent = 13)) : nativeEvent = keyCode;
        10 === nativeEvent && (nativeEvent = 13);
        return 32 <= nativeEvent || 13 === nativeEvent ? nativeEvent : 0;
      }
      function functionThatReturnsTrue() {
        return true;
      }
      function functionThatReturnsFalse() {
        return false;
      }
      function createSyntheticEvent(Interface) {
        function SyntheticBaseEvent(reactName, reactEventType, targetInst, nativeEvent, nativeEventTarget) {
          this._reactName = reactName;
          this._targetInst = targetInst;
          this.type = reactEventType;
          this.nativeEvent = nativeEvent;
          this.target = nativeEventTarget;
          this.currentTarget = null;
          for (var propName in Interface)
            Interface.hasOwnProperty(propName) && (reactName = Interface[propName], this[propName] = reactName ? reactName(nativeEvent) : nativeEvent[propName]);
          this.isDefaultPrevented = (null != nativeEvent.defaultPrevented ? nativeEvent.defaultPrevented : false === nativeEvent.returnValue) ? functionThatReturnsTrue : functionThatReturnsFalse;
          this.isPropagationStopped = functionThatReturnsFalse;
          return this;
        }
        assign(SyntheticBaseEvent.prototype, {
          preventDefault: function() {
            this.defaultPrevented = true;
            var event = this.nativeEvent;
            event && (event.preventDefault ? event.preventDefault() : "unknown" !== typeof event.returnValue && (event.returnValue = false), this.isDefaultPrevented = functionThatReturnsTrue);
          },
          stopPropagation: function() {
            var event = this.nativeEvent;
            event && (event.stopPropagation ? event.stopPropagation() : "unknown" !== typeof event.cancelBubble && (event.cancelBubble = true), this.isPropagationStopped = functionThatReturnsTrue);
          },
          persist: function() {
          },
          isPersistent: functionThatReturnsTrue
        });
        return SyntheticBaseEvent;
      }
      var EventInterface = {
        eventPhase: 0,
        bubbles: 0,
        cancelable: 0,
        timeStamp: function(event) {
          return event.timeStamp || Date.now();
        },
        defaultPrevented: 0,
        isTrusted: 0
      };
      var SyntheticEvent = createSyntheticEvent(EventInterface);
      var UIEventInterface = assign({}, EventInterface, { view: 0, detail: 0 });
      var SyntheticUIEvent = createSyntheticEvent(UIEventInterface);
      var lastMovementX;
      var lastMovementY;
      var lastMouseEvent;
      var MouseEventInterface = assign({}, UIEventInterface, {
        screenX: 0,
        screenY: 0,
        clientX: 0,
        clientY: 0,
        pageX: 0,
        pageY: 0,
        ctrlKey: 0,
        shiftKey: 0,
        altKey: 0,
        metaKey: 0,
        getModifierState: getEventModifierState,
        button: 0,
        buttons: 0,
        relatedTarget: function(event) {
          return void 0 === event.relatedTarget ? event.fromElement === event.srcElement ? event.toElement : event.fromElement : event.relatedTarget;
        },
        movementX: function(event) {
          if ("movementX" in event) return event.movementX;
          event !== lastMouseEvent && (lastMouseEvent && "mousemove" === event.type ? (lastMovementX = event.screenX - lastMouseEvent.screenX, lastMovementY = event.screenY - lastMouseEvent.screenY) : lastMovementY = lastMovementX = 0, lastMouseEvent = event);
          return lastMovementX;
        },
        movementY: function(event) {
          return "movementY" in event ? event.movementY : lastMovementY;
        }
      });
      var SyntheticMouseEvent = createSyntheticEvent(MouseEventInterface);
      var DragEventInterface = assign({}, MouseEventInterface, { dataTransfer: 0 });
      var SyntheticDragEvent = createSyntheticEvent(DragEventInterface);
      var FocusEventInterface = assign({}, UIEventInterface, { relatedTarget: 0 });
      var SyntheticFocusEvent = createSyntheticEvent(FocusEventInterface);
      var AnimationEventInterface = assign({}, EventInterface, {
        animationName: 0,
        elapsedTime: 0,
        pseudoElement: 0
      });
      var SyntheticAnimationEvent = createSyntheticEvent(AnimationEventInterface);
      var ClipboardEventInterface = assign({}, EventInterface, {
        clipboardData: function(event) {
          return "clipboardData" in event ? event.clipboardData : window.clipboardData;
        }
      });
      var SyntheticClipboardEvent = createSyntheticEvent(ClipboardEventInterface);
      var CompositionEventInterface = assign({}, EventInterface, { data: 0 });
      var SyntheticCompositionEvent = createSyntheticEvent(CompositionEventInterface);
      var normalizeKey = {
        Esc: "Escape",
        Spacebar: " ",
        Left: "ArrowLeft",
        Up: "ArrowUp",
        Right: "ArrowRight",
        Down: "ArrowDown",
        Del: "Delete",
        Win: "OS",
        Menu: "ContextMenu",
        Apps: "ContextMenu",
        Scroll: "ScrollLock",
        MozPrintableKey: "Unidentified"
      };
      var translateToKey = {
        8: "Backspace",
        9: "Tab",
        12: "Clear",
        13: "Enter",
        16: "Shift",
        17: "Control",
        18: "Alt",
        19: "Pause",
        20: "CapsLock",
        27: "Escape",
        32: " ",
        33: "PageUp",
        34: "PageDown",
        35: "End",
        36: "Home",
        37: "ArrowLeft",
        38: "ArrowUp",
        39: "ArrowRight",
        40: "ArrowDown",
        45: "Insert",
        46: "Delete",
        112: "F1",
        113: "F2",
        114: "F3",
        115: "F4",
        116: "F5",
        117: "F6",
        118: "F7",
        119: "F8",
        120: "F9",
        121: "F10",
        122: "F11",
        123: "F12",
        144: "NumLock",
        145: "ScrollLock",
        224: "Meta"
      };
      var modifierKeyToProp = {
        Alt: "altKey",
        Control: "ctrlKey",
        Meta: "metaKey",
        Shift: "shiftKey"
      };
      function modifierStateGetter(keyArg) {
        var nativeEvent = this.nativeEvent;
        return nativeEvent.getModifierState ? nativeEvent.getModifierState(keyArg) : (keyArg = modifierKeyToProp[keyArg]) ? !!nativeEvent[keyArg] : false;
      }
      function getEventModifierState() {
        return modifierStateGetter;
      }
      var KeyboardEventInterface = assign({}, UIEventInterface, {
        key: function(nativeEvent) {
          if (nativeEvent.key) {
            var key = normalizeKey[nativeEvent.key] || nativeEvent.key;
            if ("Unidentified" !== key) return key;
          }
          return "keypress" === nativeEvent.type ? (nativeEvent = getEventCharCode(nativeEvent), 13 === nativeEvent ? "Enter" : String.fromCharCode(nativeEvent)) : "keydown" === nativeEvent.type || "keyup" === nativeEvent.type ? translateToKey[nativeEvent.keyCode] || "Unidentified" : "";
        },
        code: 0,
        location: 0,
        ctrlKey: 0,
        shiftKey: 0,
        altKey: 0,
        metaKey: 0,
        repeat: 0,
        locale: 0,
        getModifierState: getEventModifierState,
        charCode: function(event) {
          return "keypress" === event.type ? getEventCharCode(event) : 0;
        },
        keyCode: function(event) {
          return "keydown" === event.type || "keyup" === event.type ? event.keyCode : 0;
        },
        which: function(event) {
          return "keypress" === event.type ? getEventCharCode(event) : "keydown" === event.type || "keyup" === event.type ? event.keyCode : 0;
        }
      });
      var SyntheticKeyboardEvent = createSyntheticEvent(KeyboardEventInterface);
      var PointerEventInterface = assign({}, MouseEventInterface, {
        pointerId: 0,
        width: 0,
        height: 0,
        pressure: 0,
        tangentialPressure: 0,
        tiltX: 0,
        tiltY: 0,
        twist: 0,
        pointerType: 0,
        isPrimary: 0
      });
      var SyntheticPointerEvent = createSyntheticEvent(PointerEventInterface);
      var SubmitEventInterface = assign({}, EventInterface, { submitter: 0 });
      var SyntheticSubmitEvent = createSyntheticEvent(SubmitEventInterface);
      var TouchEventInterface = assign({}, UIEventInterface, {
        touches: 0,
        targetTouches: 0,
        changedTouches: 0,
        altKey: 0,
        metaKey: 0,
        ctrlKey: 0,
        shiftKey: 0,
        getModifierState: getEventModifierState
      });
      var SyntheticTouchEvent = createSyntheticEvent(TouchEventInterface);
      var TransitionEventInterface = assign({}, EventInterface, {
        propertyName: 0,
        elapsedTime: 0,
        pseudoElement: 0
      });
      var SyntheticTransitionEvent = createSyntheticEvent(TransitionEventInterface);
      var WheelEventInterface = assign({}, MouseEventInterface, {
        deltaX: function(event) {
          return "deltaX" in event ? event.deltaX : "wheelDeltaX" in event ? -event.wheelDeltaX : 0;
        },
        deltaY: function(event) {
          return "deltaY" in event ? event.deltaY : "wheelDeltaY" in event ? -event.wheelDeltaY : "wheelDelta" in event ? -event.wheelDelta : 0;
        },
        deltaZ: 0,
        deltaMode: 0
      });
      var SyntheticWheelEvent = createSyntheticEvent(WheelEventInterface);
      var ToggleEventInterface = assign({}, EventInterface, {
        newState: 0,
        oldState: 0,
        source: 0
      });
      var SyntheticToggleEvent = createSyntheticEvent(ToggleEventInterface);
      var END_KEYCODES = [9, 13, 27, 32];
      var canUseCompositionEvent = canUseDOM && "CompositionEvent" in window;
      var documentMode = null;
      canUseDOM && "documentMode" in document && (documentMode = document.documentMode);
      var canUseTextInputEvent = canUseDOM && "TextEvent" in window && !documentMode;
      var useFallbackCompositionData = canUseDOM && (!canUseCompositionEvent || documentMode && 8 < documentMode && 11 >= documentMode);
      var SPACEBAR_CHAR = String.fromCharCode(32);
      var hasSpaceKeypress = false;
      function isFallbackCompositionEnd(domEventName, nativeEvent) {
        switch (domEventName) {
          case "keyup":
            return -1 !== END_KEYCODES.indexOf(nativeEvent.keyCode);
          case "keydown":
            return 229 !== nativeEvent.keyCode;
          case "keypress":
          case "mousedown":
          case "focusout":
            return true;
          default:
            return false;
        }
      }
      function getDataFromCustomEvent(nativeEvent) {
        nativeEvent = nativeEvent.detail;
        return "object" === typeof nativeEvent && "data" in nativeEvent ? nativeEvent.data : null;
      }
      var isComposing = false;
      function getNativeBeforeInputChars(domEventName, nativeEvent) {
        switch (domEventName) {
          case "compositionend":
            return getDataFromCustomEvent(nativeEvent);
          case "keypress":
            if (32 !== nativeEvent.which) return null;
            hasSpaceKeypress = true;
            return SPACEBAR_CHAR;
          case "textInput":
            return domEventName = nativeEvent.data, domEventName === SPACEBAR_CHAR && hasSpaceKeypress ? null : domEventName;
          default:
            return null;
        }
      }
      function getFallbackBeforeInputChars(domEventName, nativeEvent) {
        if (isComposing)
          return "compositionend" === domEventName || !canUseCompositionEvent && isFallbackCompositionEnd(domEventName, nativeEvent) ? (domEventName = getData(), fallbackText = startText = root = null, isComposing = false, domEventName) : null;
        switch (domEventName) {
          case "paste":
            return null;
          case "keypress":
            if (!(nativeEvent.ctrlKey || nativeEvent.altKey || nativeEvent.metaKey) || nativeEvent.ctrlKey && nativeEvent.altKey) {
              if (nativeEvent.char && 1 < nativeEvent.char.length)
                return nativeEvent.char;
              if (nativeEvent.which) return String.fromCharCode(nativeEvent.which);
            }
            return null;
          case "compositionend":
            return useFallbackCompositionData && "ko" !== nativeEvent.locale ? null : nativeEvent.data;
          default:
            return null;
        }
      }
      var supportedInputTypes = {
        color: true,
        date: true,
        datetime: true,
        "datetime-local": true,
        email: true,
        month: true,
        number: true,
        password: true,
        range: true,
        search: true,
        tel: true,
        text: true,
        time: true,
        url: true,
        week: true
      };
      function isTextInputElement(elem) {
        var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
        return "input" === nodeName ? !!supportedInputTypes[elem.type] : "textarea" === nodeName ? true : false;
      }
      function createAndAccumulateChangeEvent(dispatchQueue, inst, nativeEvent, target) {
        restoreTarget ? restoreQueue ? restoreQueue.push(target) : restoreQueue = [target] : restoreTarget = target;
        inst = accumulateTwoPhaseListeners(inst, "onChange");
        0 < inst.length && (nativeEvent = new SyntheticEvent(
          "onChange",
          "change",
          null,
          nativeEvent,
          target
        ), dispatchQueue.push({ event: nativeEvent, listeners: inst }));
      }
      var activeElement$1 = null;
      var activeElementInst$1 = null;
      function runEventInBatch(dispatchQueue) {
        processDispatchQueue(dispatchQueue, 0);
      }
      function getInstIfValueChanged(targetInst) {
        var targetNode = getNodeFromInstance(targetInst);
        if (updateValueIfChanged(targetNode)) return targetInst;
      }
      function getTargetInstForChangeEvent(domEventName, targetInst) {
        if ("change" === domEventName) return targetInst;
      }
      var isInputEventSupported = false;
      if (canUseDOM) {
        if (canUseDOM) {
          isSupported$jscomp$inline_474 = "oninput" in document;
          if (!isSupported$jscomp$inline_474) {
            element$jscomp$inline_475 = document.createElement("div");
            element$jscomp$inline_475.setAttribute("oninput", "return;");
            isSupported$jscomp$inline_474 = "function" === typeof element$jscomp$inline_475.oninput;
          }
          JSCompiler_inline_result$jscomp$318 = isSupported$jscomp$inline_474;
        } else JSCompiler_inline_result$jscomp$318 = false;
        isInputEventSupported = JSCompiler_inline_result$jscomp$318 && (!document.documentMode || 9 < document.documentMode);
      }
      var JSCompiler_inline_result$jscomp$318;
      var isSupported$jscomp$inline_474;
      var element$jscomp$inline_475;
      function stopWatchingForValueChange() {
        activeElement$1 && (activeElement$1.detachEvent("onpropertychange", handlePropertyChange), activeElementInst$1 = activeElement$1 = null);
      }
      function handlePropertyChange(nativeEvent) {
        if ("value" === nativeEvent.propertyName && getInstIfValueChanged(activeElementInst$1)) {
          var dispatchQueue = [];
          createAndAccumulateChangeEvent(
            dispatchQueue,
            activeElementInst$1,
            nativeEvent,
            getEventTarget(nativeEvent)
          );
          batchedUpdates$1(runEventInBatch, dispatchQueue);
        }
      }
      function handleEventsForInputEventPolyfill(domEventName, target, targetInst) {
        "focusin" === domEventName ? (stopWatchingForValueChange(), activeElement$1 = target, activeElementInst$1 = targetInst, activeElement$1.attachEvent("onpropertychange", handlePropertyChange)) : "focusout" === domEventName && stopWatchingForValueChange();
      }
      function getTargetInstForInputEventPolyfill(domEventName) {
        if ("selectionchange" === domEventName || "keyup" === domEventName || "keydown" === domEventName)
          return getInstIfValueChanged(activeElementInst$1);
      }
      function getTargetInstForClickEvent(domEventName, targetInst) {
        if ("click" === domEventName) return getInstIfValueChanged(targetInst);
      }
      function getTargetInstForInputOrChangeEvent(domEventName, targetInst) {
        if ("input" === domEventName || "change" === domEventName)
          return getInstIfValueChanged(targetInst);
      }
      function is(x, y) {
        return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
      }
      var objectIs = "function" === typeof Object.is ? Object.is : is;
      function shallowEqual(objA, objB) {
        if (objectIs(objA, objB)) return true;
        if ("object" !== typeof objA || null === objA || "object" !== typeof objB || null === objB)
          return false;
        var keysA = Object.keys(objA), keysB = Object.keys(objB);
        if (keysA.length !== keysB.length) return false;
        for (keysB = 0; keysB < keysA.length; keysB++) {
          var currentKey = keysA[keysB];
          if (!hasOwnProperty.call(objB, currentKey) || !objectIs(objA[currentKey], objB[currentKey]))
            return false;
        }
        return true;
      }
      function getActiveElement(doc) {
        doc = doc || ("undefined" !== typeof document ? document : void 0);
        if ("undefined" === typeof doc) return null;
        try {
          return doc.activeElement || doc.body;
        } catch (e$20) {
          return doc.body;
        }
      }
      function getLeafNode(node) {
        for (; node && node.firstChild; ) node = node.firstChild;
        return node;
      }
      function getNodeForCharacterOffset(root2, offset) {
        var node = getLeafNode(root2);
        root2 = 0;
        for (var nodeEnd; node; ) {
          if (3 === node.nodeType) {
            nodeEnd = root2 + node.textContent.length;
            if (root2 <= offset && nodeEnd >= offset)
              return { node, offset: offset - root2 };
            root2 = nodeEnd;
          }
          a: {
            for (; node; ) {
              if (node.nextSibling) {
                node = node.nextSibling;
                break a;
              }
              node = node.parentNode;
            }
            node = void 0;
          }
          node = getLeafNode(node);
        }
      }
      function containsNode(outerNode, innerNode) {
        return outerNode && innerNode ? outerNode === innerNode ? true : outerNode && 3 === outerNode.nodeType ? false : innerNode && 3 === innerNode.nodeType ? containsNode(outerNode, innerNode.parentNode) : "contains" in outerNode ? outerNode.contains(innerNode) : outerNode.compareDocumentPosition ? !!(outerNode.compareDocumentPosition(innerNode) & 16) : false : false;
      }
      function getActiveElementDeep(containerInfo) {
        containerInfo = null != containerInfo && null != containerInfo.ownerDocument && null != containerInfo.ownerDocument.defaultView ? containerInfo.ownerDocument.defaultView : window;
        for (var element = getActiveElement(containerInfo.document); element instanceof containerInfo.HTMLIFrameElement; ) {
          try {
            var JSCompiler_inline_result = "string" === typeof element.contentWindow.location.href;
          } catch (err) {
            JSCompiler_inline_result = false;
          }
          if (JSCompiler_inline_result) containerInfo = element.contentWindow;
          else break;
          element = getActiveElement(containerInfo.document);
        }
        return element;
      }
      function hasSelectionCapabilities(elem) {
        var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
        return nodeName && ("input" === nodeName && ("text" === elem.type || "search" === elem.type || "tel" === elem.type || "url" === elem.type || "password" === elem.type) || "textarea" === nodeName || "true" === elem.contentEditable);
      }
      var skipSelectionChangeEvent = canUseDOM && "documentMode" in document && 11 >= document.documentMode;
      var activeElement = null;
      var activeElementInst = null;
      var lastSelection = null;
      var mouseDown = false;
      function constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget) {
        var doc = nativeEventTarget.window === nativeEventTarget ? nativeEventTarget.document : 9 === nativeEventTarget.nodeType ? nativeEventTarget : nativeEventTarget.ownerDocument;
        mouseDown || null == activeElement || activeElement !== getActiveElement(doc) || (doc = activeElement, "selectionStart" in doc && hasSelectionCapabilities(doc) ? doc = { start: doc.selectionStart, end: doc.selectionEnd } : (doc = (doc.ownerDocument && doc.ownerDocument.defaultView || window).getSelection(), doc = {
          anchorNode: doc.anchorNode,
          anchorOffset: doc.anchorOffset,
          focusNode: doc.focusNode,
          focusOffset: doc.focusOffset
        }), lastSelection && shallowEqual(lastSelection, doc) || (lastSelection = doc, doc = accumulateTwoPhaseListeners(activeElementInst, "onSelect"), 0 < doc.length && (nativeEvent = new SyntheticEvent(
          "onSelect",
          "select",
          null,
          nativeEvent,
          nativeEventTarget
        ), dispatchQueue.push({ event: nativeEvent, listeners: doc }), nativeEvent.target = activeElement)));
      }
      function makePrefixMap(styleProp, eventName) {
        var prefixes = {};
        prefixes[styleProp.toLowerCase()] = eventName.toLowerCase();
        prefixes["Webkit" + styleProp] = "webkit" + eventName;
        prefixes["Moz" + styleProp] = "moz" + eventName;
        return prefixes;
      }
      var vendorPrefixes = {
        animationend: makePrefixMap("Animation", "AnimationEnd"),
        animationiteration: makePrefixMap("Animation", "AnimationIteration"),
        animationstart: makePrefixMap("Animation", "AnimationStart"),
        transitionrun: makePrefixMap("Transition", "TransitionRun"),
        transitionstart: makePrefixMap("Transition", "TransitionStart"),
        transitioncancel: makePrefixMap("Transition", "TransitionCancel"),
        transitionend: makePrefixMap("Transition", "TransitionEnd")
      };
      var prefixedEventNames = {};
      var style = {};
      canUseDOM && (style = document.createElement("div").style, "AnimationEvent" in window || (delete vendorPrefixes.animationend.animation, delete vendorPrefixes.animationiteration.animation, delete vendorPrefixes.animationstart.animation), "TransitionEvent" in window || delete vendorPrefixes.transitionend.transition);
      function getVendorPrefixedEventName(eventName) {
        if (prefixedEventNames[eventName]) return prefixedEventNames[eventName];
        if (!vendorPrefixes[eventName]) return eventName;
        var prefixMap = vendorPrefixes[eventName], styleProp;
        for (styleProp in prefixMap)
          if (prefixMap.hasOwnProperty(styleProp) && styleProp in style)
            return prefixedEventNames[eventName] = prefixMap[styleProp];
        return eventName;
      }
      var ANIMATION_END = getVendorPrefixedEventName("animationend");
      var ANIMATION_ITERATION = getVendorPrefixedEventName("animationiteration");
      var ANIMATION_START = getVendorPrefixedEventName("animationstart");
      var TRANSITION_RUN = getVendorPrefixedEventName("transitionrun");
      var TRANSITION_START = getVendorPrefixedEventName("transitionstart");
      var TRANSITION_CANCEL = getVendorPrefixedEventName("transitioncancel");
      var TRANSITION_END = getVendorPrefixedEventName("transitionend");
      var topLevelEventsToReactNames = /* @__PURE__ */ new Map();
      var simpleEventPluginEvents = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error fullscreenChange fullscreenError gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
        " "
      );
      simpleEventPluginEvents.push("scrollEnd");
      function registerSimpleEvent(domEventName, reactName) {
        topLevelEventsToReactNames.set(domEventName, reactName);
        registerTwoPhaseEvent(reactName, [domEventName]);
      }
      var globalClientIdCounter$1 = 0;
      function getViewTransitionName(props, instance) {
        if (null != props.name && "auto" !== props.name) return props.name;
        if (null !== instance.autoName) return instance.autoName;
        props = pendingEffectsRoot.identifierPrefix;
        var globalClientId = globalClientIdCounter$1++;
        props = "_" + props + "t_" + globalClientId.toString(32) + "_";
        return instance.autoName = props;
      }
      function getClassNameByType(classByType) {
        if (null == classByType || "string" === typeof classByType)
          return classByType;
        var className = null, activeTypes = pendingTransitionTypes;
        if (null !== activeTypes)
          for (var i = 0; i < activeTypes.length; i++) {
            var match = classByType[activeTypes[i]];
            if (null != match) {
              if ("none" === match) return "none";
              className = null == className ? match : className + (" " + match);
            }
          }
        return null == className ? classByType.default : className;
      }
      function getViewTransitionClassName(defaultClass, eventClass) {
        defaultClass = getClassNameByType(defaultClass);
        eventClass = getClassNameByType(eventClass);
        return null == eventClass ? "auto" === defaultClass ? null : defaultClass : "auto" === eventClass ? null : eventClass;
      }
      var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
        if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
          var event = new window.ErrorEvent("error", {
            bubbles: true,
            cancelable: true,
            message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
            error
          });
          if (!window.dispatchEvent(event)) return;
        } else if ("object" === typeof process && "function" === typeof process.emit) {
          process.emit("uncaughtException", error);
          return;
        }
        console.error(error);
      };
      var concurrentQueues = [];
      var concurrentQueuesIndex = 0;
      var concurrentlyUpdatedLanes = 0;
      function finishQueueingConcurrentUpdates() {
        for (var endIndex = concurrentQueuesIndex, i = concurrentlyUpdatedLanes = concurrentQueuesIndex = 0; i < endIndex; ) {
          var fiber = concurrentQueues[i];
          concurrentQueues[i++] = null;
          var queue = concurrentQueues[i];
          concurrentQueues[i++] = null;
          var update = concurrentQueues[i];
          concurrentQueues[i++] = null;
          var lane = concurrentQueues[i];
          concurrentQueues[i++] = null;
          if (null !== queue && null !== update) {
            var pending = queue.pending;
            null === pending ? update.next = update : (update.next = pending.next, pending.next = update);
            queue.pending = update;
          }
          0 !== lane && markUpdateLaneFromFiberToRoot(fiber, update, lane);
        }
      }
      function enqueueUpdate$1(fiber, queue, update, lane) {
        concurrentQueues[concurrentQueuesIndex++] = fiber;
        concurrentQueues[concurrentQueuesIndex++] = queue;
        concurrentQueues[concurrentQueuesIndex++] = update;
        concurrentQueues[concurrentQueuesIndex++] = lane;
        concurrentlyUpdatedLanes |= lane;
        fiber.lanes |= lane;
        fiber = fiber.alternate;
        null !== fiber && (fiber.lanes |= lane);
      }
      function enqueueConcurrentHookUpdate(fiber, queue, update, lane) {
        enqueueUpdate$1(fiber, queue, update, lane);
        return getRootForUpdatedFiber(fiber);
      }
      function enqueueConcurrentRenderForLane(fiber, lane) {
        enqueueUpdate$1(fiber, null, null, lane);
        return getRootForUpdatedFiber(fiber);
      }
      function markUpdateLaneFromFiberToRoot(sourceFiber, update, lane) {
        sourceFiber.lanes |= lane;
        var alternate = sourceFiber.alternate;
        null !== alternate && (alternate.lanes |= lane);
        for (var isHidden = false, parent = sourceFiber.return; null !== parent; )
          parent.childLanes |= lane, alternate = parent.alternate, null !== alternate && (alternate.childLanes |= lane), 22 === parent.tag && (sourceFiber = parent.stateNode, null === sourceFiber || sourceFiber._visibility & 1 || (isHidden = true)), sourceFiber = parent, parent = parent.return;
        return 3 === sourceFiber.tag ? (parent = sourceFiber.stateNode, isHidden && null !== update && (isHidden = 31 - clz32(lane), sourceFiber = parent.hiddenUpdates, alternate = sourceFiber[isHidden], null === alternate ? sourceFiber[isHidden] = [update] : alternate.push(update), update.lane = lane | 536870912), parent) : null;
      }
      function getRootForUpdatedFiber(sourceFiber) {
        if (50 < nestedUpdateCount)
          throw nestedUpdateCount = 0, rootWithNestedUpdates = null, Error(formatProdErrorMessage(185));
        for (var parent = sourceFiber.return; null !== parent; )
          sourceFiber = parent, parent = sourceFiber.return;
        return 3 === sourceFiber.tag ? sourceFiber.stateNode : null;
      }
      var emptyContextObject = {};
      function FiberNode(tag, pendingProps, key, mode) {
        this.tag = tag;
        this.key = key;
        this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null;
        this.index = 0;
        this.refCleanup = this.ref = null;
        this.pendingProps = pendingProps;
        this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
        this.mode = mode;
        this.subtreeFlags = this.flags = 0;
        this.deletions = null;
        this.childLanes = this.lanes = 0;
        this.alternate = null;
      }
      function createFiberImplClass(tag, pendingProps, key, mode) {
        return new FiberNode(tag, pendingProps, key, mode);
      }
      function shouldConstruct(Component) {
        Component = Component.prototype;
        return !(!Component || !Component.isReactComponent);
      }
      function createWorkInProgress(current, pendingProps) {
        var workInProgress2 = current.alternate;
        null === workInProgress2 ? (workInProgress2 = createFiberImplClass(
          current.tag,
          pendingProps,
          current.key,
          current.mode
        ), workInProgress2.elementType = current.elementType, workInProgress2.type = current.type, workInProgress2.stateNode = current.stateNode, workInProgress2.alternate = current, current.alternate = workInProgress2) : (workInProgress2.pendingProps = pendingProps, workInProgress2.type = current.type, workInProgress2.flags = 0, workInProgress2.subtreeFlags = 0, workInProgress2.deletions = null);
        workInProgress2.flags = current.flags & 1206910976;
        workInProgress2.childLanes = current.childLanes;
        workInProgress2.lanes = current.lanes;
        workInProgress2.child = current.child;
        workInProgress2.memoizedProps = current.memoizedProps;
        workInProgress2.memoizedState = current.memoizedState;
        workInProgress2.updateQueue = current.updateQueue;
        pendingProps = current.dependencies;
        workInProgress2.dependencies = null === pendingProps ? null : { lanes: pendingProps.lanes, firstContext: pendingProps.firstContext };
        workInProgress2.sibling = current.sibling;
        workInProgress2.index = current.index;
        workInProgress2.ref = current.ref;
        workInProgress2.refCleanup = current.refCleanup;
        return workInProgress2;
      }
      function resetWorkInProgress(workInProgress2, renderLanes2) {
        workInProgress2.flags &= 1206910978;
        var current = workInProgress2.alternate;
        null === current ? (workInProgress2.childLanes = 0, workInProgress2.lanes = renderLanes2, workInProgress2.child = null, workInProgress2.subtreeFlags = 0, workInProgress2.memoizedProps = null, workInProgress2.memoizedState = null, workInProgress2.updateQueue = null, workInProgress2.dependencies = null, workInProgress2.stateNode = null) : (workInProgress2.childLanes = current.childLanes, workInProgress2.lanes = current.lanes, workInProgress2.child = current.child, workInProgress2.subtreeFlags = 0, workInProgress2.deletions = null, workInProgress2.memoizedProps = current.memoizedProps, workInProgress2.memoizedState = current.memoizedState, workInProgress2.updateQueue = current.updateQueue, workInProgress2.type = current.type, renderLanes2 = current.dependencies, workInProgress2.dependencies = null === renderLanes2 ? null : {
          lanes: renderLanes2.lanes,
          firstContext: renderLanes2.firstContext
        });
        return workInProgress2;
      }
      function createFiberFromTypeAndProps(type, key, pendingProps, owner, mode, lanes) {
        var fiberTag = 0;
        owner = type;
        if ("function" === typeof owner) shouldConstruct(owner) && (fiberTag = 1);
        else if ("string" === typeof owner)
          fiberTag = isHostHoistableType(
            type,
            pendingProps,
            contextStackCursor.current
          ) ? 26 : "html" === type || "head" === type || "body" === type ? 27 : 5;
        else
          a: switch (owner) {
            case REACT_ACTIVITY_TYPE:
              return type = createFiberImplClass(31, pendingProps, key, mode), type.elementType = REACT_ACTIVITY_TYPE, type.lanes = lanes, type;
            case REACT_FRAGMENT_TYPE:
              return createFiberFromFragment(pendingProps.children, mode, lanes, key);
            case REACT_STRICT_MODE_TYPE:
              fiberTag = 8;
              mode |= 24;
              break;
            case REACT_PROFILER_TYPE:
              return type = createFiberImplClass(12, pendingProps, key, mode | 2), type.elementType = REACT_PROFILER_TYPE, type.lanes = lanes, type;
            case REACT_SUSPENSE_TYPE:
              return type = createFiberImplClass(13, pendingProps, key, mode), type.elementType = REACT_SUSPENSE_TYPE, type.lanes = lanes, type;
            case REACT_SUSPENSE_LIST_TYPE:
              return type = createFiberImplClass(19, pendingProps, key, mode), type.elementType = REACT_SUSPENSE_LIST_TYPE, type.lanes = lanes, type;
            case REACT_LEGACY_HIDDEN_TYPE:
            case REACT_VIEW_TRANSITION_TYPE:
              return type = mode | 32, type = createFiberImplClass(30, pendingProps, key, type), type.elementType = REACT_VIEW_TRANSITION_TYPE, type.lanes = lanes, type.stateNode = {
                autoName: null,
                paired: null,
                clones: null,
                ref: null
              }, type;
            default:
              if ("object" === typeof owner && null !== owner)
                switch (owner.$$typeof) {
                  case REACT_CONTEXT_TYPE:
                    fiberTag = 10;
                    break a;
                  case REACT_CONSUMER_TYPE:
                    fiberTag = 9;
                    break a;
                  case REACT_FORWARD_REF_TYPE:
                    fiberTag = 11;
                    break a;
                  case REACT_MEMO_TYPE:
                    fiberTag = 14;
                    break a;
                  case REACT_LAZY_TYPE:
                    fiberTag = 16;
                    owner = null;
                    break a;
                }
              fiberTag = 29;
              pendingProps = Error(
                formatProdErrorMessage(130, null === type ? "null" : typeof type, "")
              );
              owner = null;
          }
        key = createFiberImplClass(fiberTag, pendingProps, key, mode);
        key.elementType = type;
        key.type = owner;
        key.lanes = lanes;
        return key;
      }
      function createFiberFromFragment(elements, mode, lanes, key) {
        elements = createFiberImplClass(7, elements, key, mode);
        elements.lanes = lanes;
        return elements;
      }
      function createFiberFromText(content, mode, lanes) {
        content = createFiberImplClass(6, content, null, mode);
        content.lanes = lanes;
        return content;
      }
      function createFiberFromDehydratedFragment(dehydratedNode) {
        var fiber = createFiberImplClass(18, null, null, 0);
        fiber.stateNode = dehydratedNode;
        return fiber;
      }
      function createFiberFromPortal(portal, mode, lanes) {
        mode = createFiberImplClass(
          4,
          null !== portal.children ? portal.children : [],
          portal.key,
          mode
        );
        mode.lanes = lanes;
        mode.stateNode = {
          containerInfo: portal.containerInfo,
          pendingChildren: null,
          implementation: portal.implementation
        };
        return mode;
      }
      var CapturedStacks = /* @__PURE__ */ new WeakMap();
      function createCapturedValueAtFiber(value, source) {
        if ("object" === typeof value && null !== value) {
          var existing = CapturedStacks.get(value);
          if (void 0 !== existing) return existing;
          source = {
            value,
            source,
            stack: getStackByFiberInDevAndProd(source)
          };
          CapturedStacks.set(value, source);
          return source;
        }
        return {
          value,
          source,
          stack: getStackByFiberInDevAndProd(source)
        };
      }
      var forkStack = [];
      var forkStackIndex = 0;
      var treeForkProvider = null;
      var treeForkCount = 0;
      var idStack = [];
      var idStackIndex = 0;
      var treeContextProvider = null;
      var treeContextId = 1;
      var treeContextOverflow = "";
      function pushTreeFork(workInProgress2, totalChildren) {
        forkStack[forkStackIndex++] = treeForkCount;
        forkStack[forkStackIndex++] = treeForkProvider;
        treeForkProvider = workInProgress2;
        treeForkCount = totalChildren;
      }
      function pushTreeId(workInProgress2, totalChildren, index2) {
        idStack[idStackIndex++] = treeContextId;
        idStack[idStackIndex++] = treeContextOverflow;
        idStack[idStackIndex++] = treeContextProvider;
        treeContextProvider = workInProgress2;
        var baseIdWithLeadingBit = treeContextId;
        workInProgress2 = treeContextOverflow;
        var baseLength = 32 - clz32(baseIdWithLeadingBit) - 1;
        baseIdWithLeadingBit &= ~(1 << baseLength);
        index2 += 1;
        var length = 32 - clz32(totalChildren) + baseLength;
        if (30 < length) {
          var numberOfOverflowBits = baseLength - baseLength % 5;
          length = (baseIdWithLeadingBit & (1 << numberOfOverflowBits) - 1).toString(32);
          baseIdWithLeadingBit >>= numberOfOverflowBits;
          baseLength -= numberOfOverflowBits;
          treeContextId = 1 << 32 - clz32(totalChildren) + baseLength | index2 << baseLength | baseIdWithLeadingBit;
          treeContextOverflow = length + workInProgress2;
        } else
          treeContextId = 1 << length | index2 << baseLength | baseIdWithLeadingBit, treeContextOverflow = workInProgress2;
      }
      function pushMaterializedTreeId(workInProgress2) {
        null !== workInProgress2.return && (pushTreeFork(workInProgress2, 1), pushTreeId(workInProgress2, 1, 0));
      }
      function popTreeContext(workInProgress2) {
        for (; workInProgress2 === treeForkProvider; )
          treeForkProvider = forkStack[--forkStackIndex], forkStack[forkStackIndex] = null, treeForkCount = forkStack[--forkStackIndex], forkStack[forkStackIndex] = null;
        for (; workInProgress2 === treeContextProvider; )
          treeContextProvider = idStack[--idStackIndex], idStack[idStackIndex] = null, treeContextOverflow = idStack[--idStackIndex], idStack[idStackIndex] = null, treeContextId = idStack[--idStackIndex], idStack[idStackIndex] = null;
      }
      function restoreSuspendedTreeContext(workInProgress2, suspendedContext) {
        idStack[idStackIndex++] = treeContextId;
        idStack[idStackIndex++] = treeContextOverflow;
        idStack[idStackIndex++] = treeContextProvider;
        treeContextId = suspendedContext.id;
        treeContextOverflow = suspendedContext.overflow;
        treeContextProvider = workInProgress2;
      }
      var hydrationParentFiber = null;
      var nextHydratableInstance = null;
      var isHydrating = false;
      var hydrationErrors = null;
      var rootOrSingletonContext = false;
      var HydrationMismatchException = Error(formatProdErrorMessage(519));
      function throwOnHydrationMismatch(fiber) {
        var error = Error(
          formatProdErrorMessage(
            418,
            1 < arguments.length && void 0 !== arguments[1] && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        queueHydrationError(createCapturedValueAtFiber(error, fiber));
        throw HydrationMismatchException;
      }
      function prepareToHydrateHostInstance(fiber) {
        var instance = fiber.stateNode, type = fiber.type, props = fiber.memoizedProps;
        instance[internalInstanceKey] = fiber;
        instance[internalPropsKey] = props;
        switch (type) {
          case "dialog":
            listenToNonDelegatedEvent("cancel", instance);
            listenToNonDelegatedEvent("close", instance);
            break;
          case "iframe":
          case "object":
          case "embed":
            listenToNonDelegatedEvent("load", instance);
            break;
          case "video":
          case "audio":
            for (type = 0; type < mediaEventTypes.length; type++)
              listenToNonDelegatedEvent(mediaEventTypes[type], instance);
            break;
          case "source":
            listenToNonDelegatedEvent("error", instance);
            break;
          case "img":
          case "image":
          case "link":
            listenToNonDelegatedEvent("error", instance);
            listenToNonDelegatedEvent("load", instance);
            break;
          case "details":
            listenToNonDelegatedEvent("toggle", instance);
            break;
          case "input":
            listenToNonDelegatedEvent("invalid", instance);
            initInput(
              instance,
              props.value,
              props.defaultValue,
              props.checked,
              props.defaultChecked,
              props.type,
              props.name,
              true
            );
            break;
          case "select":
            listenToNonDelegatedEvent("invalid", instance);
            break;
          case "textarea":
            listenToNonDelegatedEvent("invalid", instance), initTextarea(instance, props.value, props.defaultValue, props.children);
        }
        type = props.children;
        "string" !== typeof type && "number" !== typeof type && "bigint" !== typeof type || instance.textContent === "" + type || true === props.suppressHydrationWarning || checkForUnmatchedText(instance.textContent, type) ? (null != props.popover && (listenToNonDelegatedEvent("beforetoggle", instance), listenToNonDelegatedEvent("toggle", instance)), null != props.onScroll && listenToNonDelegatedEvent("scroll", instance), null != props.onScrollEnd && listenToNonDelegatedEvent("scrollend", instance), null != props.onClick && (instance.onclick = noop$1), instance = true) : instance = false;
        instance || throwOnHydrationMismatch(fiber, true);
      }
      function popToNextHostParent(fiber) {
        for (hydrationParentFiber = fiber.return; hydrationParentFiber; )
          switch (hydrationParentFiber.tag) {
            case 5:
            case 31:
            case 13:
              rootOrSingletonContext = false;
              return;
            case 27:
            case 3:
              rootOrSingletonContext = true;
              return;
            default:
              hydrationParentFiber = hydrationParentFiber.return;
          }
      }
      function popHydrationState(fiber) {
        if (fiber !== hydrationParentFiber) return false;
        if (!isHydrating) return popToNextHostParent(fiber), isHydrating = true, false;
        var tag = fiber.tag, JSCompiler_temp;
        if (JSCompiler_temp = 3 !== tag && 27 !== tag) {
          if (JSCompiler_temp = 5 === tag)
            JSCompiler_temp = fiber.type, JSCompiler_temp = !("form" !== JSCompiler_temp && "button" !== JSCompiler_temp) || shouldSetTextContent(fiber.type, fiber.memoizedProps);
          JSCompiler_temp = !JSCompiler_temp;
        }
        JSCompiler_temp && nextHydratableInstance && throwOnHydrationMismatch(fiber);
        popToNextHostParent(fiber);
        if (13 === tag) {
          fiber = fiber.memoizedState;
          fiber = null !== fiber ? fiber.dehydrated : null;
          if (!fiber) throw Error(formatProdErrorMessage(317));
          nextHydratableInstance = getNextHydratableInstanceAfterHydrationBoundary(fiber);
        } else if (31 === tag) {
          fiber = fiber.memoizedState;
          fiber = null !== fiber ? fiber.dehydrated : null;
          if (!fiber) throw Error(formatProdErrorMessage(317));
          nextHydratableInstance = getNextHydratableInstanceAfterHydrationBoundary(fiber);
        } else
          27 === tag ? (tag = nextHydratableInstance, isSingletonScope(fiber.type) ? (fiber = previousHydratableOnEnteringScopedSingleton, previousHydratableOnEnteringScopedSingleton = null, nextHydratableInstance = fiber) : nextHydratableInstance = tag) : nextHydratableInstance = hydrationParentFiber ? getNextHydratable(fiber.stateNode.nextSibling) : null;
        return true;
      }
      function resetHydrationState() {
        nextHydratableInstance = hydrationParentFiber = null;
        isHydrating = false;
      }
      function upgradeHydrationErrorsToRecoverable() {
        var queuedErrors = hydrationErrors;
        null !== queuedErrors && (null === workInProgressRootRecoverableErrors ? workInProgressRootRecoverableErrors = queuedErrors : workInProgressRootRecoverableErrors.push.apply(
          workInProgressRootRecoverableErrors,
          queuedErrors
        ), hydrationErrors = null);
        return queuedErrors;
      }
      function queueHydrationError(error) {
        null === hydrationErrors ? hydrationErrors = [error] : hydrationErrors.push(error);
      }
      var valueCursor = createCursor(null);
      var currentlyRenderingFiber$1 = null;
      var lastContextDependency = null;
      function pushProvider(providerFiber, context, nextValue) {
        push(valueCursor, context._currentValue);
        context._currentValue = nextValue;
      }
      function popProvider(context) {
        context._currentValue = valueCursor.current;
        pop(valueCursor);
      }
      function scheduleContextWorkOnParentPath(parent, renderLanes2, propagationRoot) {
        for (; null !== parent; ) {
          var alternate = parent.alternate;
          (parent.childLanes & renderLanes2) !== renderLanes2 ? (parent.childLanes |= renderLanes2, null !== alternate && (alternate.childLanes |= renderLanes2)) : null !== alternate && (alternate.childLanes & renderLanes2) !== renderLanes2 && (alternate.childLanes |= renderLanes2);
          if (parent === propagationRoot) break;
          parent = parent.return;
        }
      }
      function propagateContextChanges(workInProgress2, contexts, renderLanes2, forcePropagateEntireTree) {
        var fiber = workInProgress2.child;
        null !== fiber && (fiber.return = workInProgress2);
        for (; null !== fiber; ) {
          var list = fiber.dependencies;
          if (null !== list) {
            var nextFiber = fiber.child;
            list = list.firstContext;
            a: for (; null !== list; ) {
              var dependency = list;
              list = fiber;
              for (var i = 0; i < contexts.length; i++)
                if (dependency.context === contexts[i]) {
                  list.lanes |= renderLanes2;
                  dependency = list.alternate;
                  null !== dependency && (dependency.lanes |= renderLanes2);
                  scheduleContextWorkOnParentPath(
                    list.return,
                    renderLanes2,
                    workInProgress2
                  );
                  forcePropagateEntireTree || (nextFiber = null);
                  break a;
                }
              list = dependency.next;
            }
          } else if (18 === fiber.tag) {
            nextFiber = fiber.return;
            if (null === nextFiber) throw Error(formatProdErrorMessage(341));
            nextFiber.lanes |= renderLanes2;
            list = nextFiber.alternate;
            null !== list && (list.lanes |= renderLanes2);
            scheduleContextWorkOnParentPath(nextFiber, renderLanes2, workInProgress2);
            nextFiber = null;
          } else
            13 === fiber.tag && null !== fiber.memoizedState && null === fiber.memoizedState.dehydrated ? (fiber.lanes |= renderLanes2, nextFiber = fiber.alternate, null !== nextFiber && (nextFiber.lanes |= renderLanes2), scheduleContextWorkOnParentPath(
              fiber.return,
              renderLanes2,
              workInProgress2
            ), nextFiber = fiber.child, nextFiber = null !== nextFiber ? nextFiber.sibling : null) : nextFiber = fiber.child;
          if (null !== nextFiber) nextFiber.return = fiber;
          else
            for (nextFiber = fiber; null !== nextFiber; ) {
              if (nextFiber === workInProgress2) {
                nextFiber = null;
                break;
              }
              fiber = nextFiber.sibling;
              if (null !== fiber) {
                fiber.return = nextFiber.return;
                nextFiber = fiber;
                break;
              }
              nextFiber = nextFiber.return;
            }
          fiber = nextFiber;
        }
      }
      function propagateParentContextChanges(current, workInProgress2, renderLanes2, forcePropagateEntireTree) {
        current = null;
        for (var parent = workInProgress2, isInsidePropagationBailout = false; null !== parent; ) {
          if (!isInsidePropagationBailout) {
            if (0 !== (parent.flags & 524288)) isInsidePropagationBailout = true;
            else if (0 !== (parent.flags & 262144)) break;
          }
          if (10 === parent.tag) {
            var currentParent = parent.alternate;
            if (null === currentParent) throw Error(formatProdErrorMessage(387));
            currentParent = currentParent.memoizedProps;
            if (null !== currentParent) {
              var context = parent.type;
              objectIs(parent.pendingProps.value, currentParent.value) || (null !== current ? current.push(context) : current = [context]);
            }
          } else if (parent === hostTransitionProviderCursor.current) {
            currentParent = parent.alternate;
            if (null === currentParent) throw Error(formatProdErrorMessage(387));
            currentParent.memoizedState.memoizedState !== parent.memoizedState.memoizedState && (null !== current ? current.push(HostTransitionContext) : current = [HostTransitionContext]);
          }
          parent = parent.return;
        }
        null !== current && propagateContextChanges(
          workInProgress2,
          current,
          renderLanes2,
          forcePropagateEntireTree
        );
        workInProgress2.flags |= 262144;
        return null !== current;
      }
      function checkIfContextChanged(currentDependencies) {
        for (currentDependencies = currentDependencies.firstContext; null !== currentDependencies; ) {
          if (!objectIs(
            currentDependencies.context._currentValue,
            currentDependencies.memoizedValue
          ))
            return true;
          currentDependencies = currentDependencies.next;
        }
        return false;
      }
      function prepareToReadContext(workInProgress2) {
        currentlyRenderingFiber$1 = workInProgress2;
        lastContextDependency = null;
        workInProgress2 = workInProgress2.dependencies;
        null !== workInProgress2 && (workInProgress2.firstContext = null);
      }
      function readContext(context) {
        return readContextForConsumer(currentlyRenderingFiber$1, context);
      }
      function readContextDuringReconciliation(consumer, context) {
        null === currentlyRenderingFiber$1 && prepareToReadContext(consumer);
        return readContextForConsumer(consumer, context);
      }
      function readContextForConsumer(consumer, context) {
        var value = context._currentValue;
        context = { context, memoizedValue: value, next: null };
        if (null === lastContextDependency) {
          if (null === consumer) throw Error(formatProdErrorMessage(308));
          lastContextDependency = context;
          consumer.dependencies = { lanes: 0, firstContext: context };
          consumer.flags |= 524288;
        } else lastContextDependency = lastContextDependency.next = context;
        return value;
      }
      var AbortControllerLocal = "undefined" !== typeof AbortController ? AbortController : function() {
        var listeners = [], signal = this.signal = {
          aborted: false,
          addEventListener: function(type, listener) {
            listeners.push(listener);
          }
        };
        this.abort = function() {
          signal.aborted = true;
          listeners.forEach(function(listener) {
            return listener();
          });
        };
      };
      var scheduleCallback$2 = Scheduler.unstable_scheduleCallback;
      var NormalPriority = Scheduler.unstable_NormalPriority;
      var CacheContext = {
        $$typeof: REACT_CONTEXT_TYPE,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      };
      function createCache() {
        return {
          controller: new AbortControllerLocal(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function releaseCache(cache) {
        cache.refCount--;
        0 === cache.refCount && scheduleCallback$2(NormalPriority, function() {
          cache.controller.abort();
        });
      }
      function queueTransitionTypes(root2, transitionTypes) {
        if (0 !== (root2.pendingLanes & 4194048)) {
          var queued = root2.transitionTypes;
          null === queued && (queued = root2.transitionTypes = []);
          for (root2 = 0; root2 < transitionTypes.length; root2++) {
            var transitionType = transitionTypes[root2];
            -1 === queued.indexOf(transitionType) && queued.push(transitionType);
          }
        }
      }
      var entangledTransitionTypes = null;
      function claimQueuedTransitionTypes(root2) {
        var claimed = root2.transitionTypes;
        root2.transitionTypes = null;
        return claimed;
      }
      var currentEntangledListeners = null;
      var currentEntangledPendingCount = 0;
      var currentEntangledLane = 0;
      var currentEntangledActionThenable = null;
      function entangleAsyncAction(transition, thenable) {
        if (null === currentEntangledListeners) {
          var entangledListeners = currentEntangledListeners = [];
          currentEntangledPendingCount = 0;
          currentEntangledLane = requestTransitionLane();
          currentEntangledActionThenable = {
            status: "pending",
            value: void 0,
            then: function(resolve) {
              entangledListeners.push(resolve);
            }
          };
        }
        currentEntangledPendingCount++;
        thenable.then(pingEngtangledActionScope, pingEngtangledActionScope);
        return thenable;
      }
      function pingEngtangledActionScope() {
        if (0 === --currentEntangledPendingCount && (entangledTransitionTypes = null, null !== currentEntangledListeners)) {
          null !== currentEntangledActionThenable && (currentEntangledActionThenable.status = "fulfilled");
          var listeners = currentEntangledListeners;
          currentEntangledListeners = null;
          currentEntangledLane = 0;
          currentEntangledActionThenable = null;
          for (var i = 0; i < listeners.length; i++) (0, listeners[i])();
        }
      }
      function chainThenableValue(thenable, result) {
        var listeners = [], thenableWithOverride = {
          status: "pending",
          value: null,
          reason: null,
          then: function(resolve) {
            listeners.push(resolve);
          }
        };
        thenable.then(
          function() {
            thenableWithOverride.status = "fulfilled";
            thenableWithOverride.value = result;
            for (var i = 0; i < listeners.length; i++) (0, listeners[i])(result);
          },
          function(error) {
            thenableWithOverride.status = "rejected";
            thenableWithOverride.reason = error;
            for (error = 0; error < listeners.length; error++)
              (0, listeners[error])(void 0);
          }
        );
        return thenableWithOverride;
      }
      var prevOnStartTransitionFinish = ReactSharedInternals.S;
      ReactSharedInternals.S = function(transition, returnValue) {
        globalMostRecentTransitionTime = now();
        "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && entangleAsyncAction(transition, returnValue);
        if (null !== entangledTransitionTypes)
          for (var root$28 = firstScheduledRoot; null !== root$28; )
            queueTransitionTypes(root$28, entangledTransitionTypes), root$28 = root$28.next;
        root$28 = transition.types;
        if (null !== root$28) {
          for (var root$29 = firstScheduledRoot; null !== root$29; )
            queueTransitionTypes(root$29, root$28), root$29 = root$29.next;
          if (0 !== currentEntangledLane) {
            root$29 = entangledTransitionTypes;
            null === root$29 && (root$29 = entangledTransitionTypes = []);
            for (var i = 0; i < root$28.length; i++) {
              var transitionType = root$28[i];
              -1 === root$29.indexOf(transitionType) && root$29.push(transitionType);
            }
          }
        }
        null !== prevOnStartTransitionFinish && prevOnStartTransitionFinish(transition, returnValue);
      };
      var resumedCache = createCursor(null);
      function peekCacheFromPool() {
        var cacheResumedFromPreviousRender = resumedCache.current;
        return null !== cacheResumedFromPreviousRender ? cacheResumedFromPreviousRender : workInProgressRoot.pooledCache;
      }
      function pushTransition(offscreenWorkInProgress, prevCachePool) {
        null === prevCachePool ? push(resumedCache, resumedCache.current) : push(resumedCache, prevCachePool.pool);
      }
      function getSuspendedCache() {
        var cacheFromPool = peekCacheFromPool();
        return null === cacheFromPool ? null : { parent: CacheContext._currentValue, pool: cacheFromPool };
      }
      var SuspenseException = Error(formatProdErrorMessage(460));
      var SuspenseyCommitException = Error(formatProdErrorMessage(474));
      var SuspenseActionException = Error(formatProdErrorMessage(542));
      var noopSuspenseyCommitThenable = { then: function() {
      } };
      function isThenableResolved(thenable) {
        thenable = thenable.status;
        return "fulfilled" === thenable || "rejected" === thenable;
      }
      function trackUsedThenable(thenableState2, thenable, index2) {
        index2 = thenableState2[index2];
        void 0 === index2 ? thenableState2.push(thenable) : index2 !== thenable && (thenable.then(noop$1, noop$1), thenable = index2);
        switch (thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            thenableState2 = thenable.reason;
            checkIfUseWrappedInAsyncCatch(thenableState2);
            if (void 0 === thenableState2 && !("reason" in thenable))
              throw Error(formatProdErrorMessage(600));
            throw thenableState2;
          default:
            if ("string" === typeof thenable.status) thenable.then(noop$1, noop$1);
            else {
              thenableState2 = workInProgressRoot;
              if (null !== thenableState2 && 100 < thenableState2.shellSuspendCounter)
                throw Error(formatProdErrorMessage(482));
              thenableState2 = thenable;
              thenableState2.status = "pending";
              thenableState2.then(
                function(fulfilledValue) {
                  if ("pending" === thenable.status) {
                    var fulfilledThenable = thenable;
                    fulfilledThenable.status = "fulfilled";
                    fulfilledThenable.value = fulfilledValue;
                  }
                },
                function(error) {
                  if ("pending" === thenable.status) {
                    var rejectedThenable = thenable;
                    rejectedThenable.status = "rejected";
                    rejectedThenable.reason = error;
                  }
                }
              );
            }
            switch (thenable.status) {
              case "fulfilled":
                return thenable.value;
              case "rejected":
                throw thenableState2 = thenable.reason, checkIfUseWrappedInAsyncCatch(thenableState2), thenableState2;
            }
            suspendedThenable = thenable;
            throw SuspenseException;
        }
      }
      function resolveLazy(lazyType) {
        try {
          var init = lazyType._init;
          return init(lazyType._payload);
        } catch (x) {
          if (null !== x && "object" === typeof x && "function" === typeof x.then)
            throw suspendedThenable = x, SuspenseException;
          throw x;
        }
      }
      var suspendedThenable = null;
      function getSuspendedThenable() {
        if (null === suspendedThenable) throw Error(formatProdErrorMessage(459));
        var thenable = suspendedThenable;
        suspendedThenable = null;
        return thenable;
      }
      function checkIfUseWrappedInAsyncCatch(rejectedReason) {
        if (rejectedReason === SuspenseException || rejectedReason === SuspenseActionException)
          throw Error(formatProdErrorMessage(483));
      }
      var thenableState$1 = null;
      var thenableIndexCounter$1 = 0;
      function unwrapThenable(thenable) {
        var index2 = thenableIndexCounter$1;
        thenableIndexCounter$1 += 1;
        null === thenableState$1 && (thenableState$1 = []);
        return trackUsedThenable(thenableState$1, thenable, index2);
      }
      function coerceRef(workInProgress2, element) {
        element = element.props.ref;
        workInProgress2.ref = void 0 !== element ? element : null;
      }
      function throwOnInvalidObjectTypeImpl(returnFiber, newChild) {
        if (newChild.$$typeof === REACT_LEGACY_ELEMENT_TYPE)
          throw Error(formatProdErrorMessage(525));
        returnFiber = Object.prototype.toString.call(newChild);
        throw Error(
          formatProdErrorMessage(
            31,
            "[object Object]" === returnFiber ? "object with keys {" + Object.keys(newChild).join(", ") + "}" : returnFiber
          )
        );
      }
      function createChildReconciler(shouldTrackSideEffects) {
        function deleteChild(returnFiber, childToDelete) {
          if (shouldTrackSideEffects) {
            var deletions = returnFiber.deletions;
            null === deletions ? (returnFiber.deletions = [childToDelete], returnFiber.flags |= 16) : deletions.push(childToDelete);
          }
        }
        function deleteRemainingChildren(returnFiber, currentFirstChild) {
          if (!shouldTrackSideEffects) return null;
          for (; null !== currentFirstChild; )
            deleteChild(returnFiber, currentFirstChild), currentFirstChild = currentFirstChild.sibling;
          return null;
        }
        function mapRemainingChildren(currentFirstChild) {
          for (var existingChildren = /* @__PURE__ */ new Map(); null !== currentFirstChild; )
            null === currentFirstChild.key ? existingChildren.set(currentFirstChild.index, currentFirstChild) : existingChildren.set(currentFirstChild.key, currentFirstChild), currentFirstChild = currentFirstChild.sibling;
          return existingChildren;
        }
        function useFiber(fiber, pendingProps) {
          fiber = createWorkInProgress(fiber, pendingProps);
          fiber.index = 0;
          fiber.sibling = null;
          return fiber;
        }
        function placeChild(newFiber, lastPlacedIndex, newIndex) {
          newFiber.index = newIndex;
          if (!shouldTrackSideEffects)
            return newFiber.flags |= 1048576, lastPlacedIndex;
          newIndex = newFiber.alternate;
          if (null !== newIndex)
            return newIndex = newIndex.index, newIndex < lastPlacedIndex ? (newFiber.flags |= 2, lastPlacedIndex) : newIndex;
          newFiber.flags |= 134217730;
          return lastPlacedIndex;
        }
        function placeSingleChild(newFiber) {
          shouldTrackSideEffects && null === newFiber.alternate && (newFiber.flags |= 134217730);
          return newFiber;
        }
        function updateTextNode(returnFiber, current, textContent, lanes) {
          if (null === current || 6 !== current.tag)
            return current = createFiberFromText(textContent, returnFiber.mode, lanes), current.return = returnFiber, current;
          current = useFiber(current, textContent);
          current.return = returnFiber;
          return current;
        }
        function updateElement(returnFiber, current, element, lanes) {
          var elementType = element.type;
          if (elementType === REACT_FRAGMENT_TYPE)
            return returnFiber = updateFragment(
              returnFiber,
              current,
              element.props.children,
              lanes,
              element.key
            ), coerceRef(returnFiber, element), returnFiber;
          if (null !== current && (current.elementType === elementType || "object" === typeof elementType && null !== elementType && elementType.$$typeof === REACT_LAZY_TYPE && resolveLazy(elementType) === current.type))
            return current = useFiber(current, element.props), coerceRef(current, element), current.return = returnFiber, current;
          current = createFiberFromTypeAndProps(
            element.type,
            element.key,
            element.props,
            null,
            returnFiber.mode,
            lanes
          );
          coerceRef(current, element);
          current.return = returnFiber;
          return current;
        }
        function updatePortal(returnFiber, current, portal, lanes) {
          if (null === current || 4 !== current.tag || current.stateNode.containerInfo !== portal.containerInfo || current.stateNode.implementation !== portal.implementation)
            return current = createFiberFromPortal(portal, returnFiber.mode, lanes), current.return = returnFiber, current;
          current = useFiber(current, portal.children || []);
          current.return = returnFiber;
          return current;
        }
        function updateFragment(returnFiber, current, fragment, lanes, key) {
          if (null === current || 7 !== current.tag)
            return current = createFiberFromFragment(
              fragment,
              returnFiber.mode,
              lanes,
              key
            ), current.return = returnFiber, current;
          current = useFiber(current, fragment);
          current.return = returnFiber;
          return current;
        }
        function createChild(returnFiber, newChild, lanes) {
          if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
            return newChild = createFiberFromText(
              "" + newChild,
              returnFiber.mode,
              lanes
            ), newChild.return = returnFiber, newChild;
          if ("object" === typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                return lanes = createFiberFromTypeAndProps(
                  newChild.type,
                  newChild.key,
                  newChild.props,
                  null,
                  returnFiber.mode,
                  lanes
                ), coerceRef(lanes, newChild), lanes.return = returnFiber, lanes;
              case REACT_PORTAL_TYPE:
                return newChild = createFiberFromPortal(
                  newChild,
                  returnFiber.mode,
                  lanes
                ), newChild.return = returnFiber, newChild;
              case REACT_LAZY_TYPE:
                return newChild = resolveLazy(newChild), createChild(returnFiber, newChild, lanes);
            }
            if (isArrayImpl(newChild) || getIteratorFn(newChild))
              return newChild = createFiberFromFragment(
                newChild,
                returnFiber.mode,
                lanes,
                null
              ), newChild.return = returnFiber, newChild;
            if ("function" === typeof newChild.then)
              return createChild(returnFiber, unwrapThenable(newChild), lanes);
            if (newChild.$$typeof === REACT_CONTEXT_TYPE)
              return createChild(
                returnFiber,
                readContextDuringReconciliation(returnFiber, newChild),
                lanes
              );
            throwOnInvalidObjectTypeImpl(returnFiber, newChild);
          }
          return null;
        }
        function updateSlot(returnFiber, oldFiber, newChild, lanes) {
          var key = null !== oldFiber ? oldFiber.key : null;
          if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
            return null !== key ? null : updateTextNode(returnFiber, oldFiber, "" + newChild, lanes);
          if ("object" === typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                return newChild.key === key ? updateElement(returnFiber, oldFiber, newChild, lanes) : null;
              case REACT_PORTAL_TYPE:
                return newChild.key === key ? updatePortal(returnFiber, oldFiber, newChild, lanes) : null;
              case REACT_LAZY_TYPE:
                return newChild = resolveLazy(newChild), updateSlot(returnFiber, oldFiber, newChild, lanes);
            }
            if (isArrayImpl(newChild) || getIteratorFn(newChild))
              return null !== key ? null : updateFragment(returnFiber, oldFiber, newChild, lanes, null);
            if ("function" === typeof newChild.then)
              return updateSlot(
                returnFiber,
                oldFiber,
                unwrapThenable(newChild),
                lanes
              );
            if (newChild.$$typeof === REACT_CONTEXT_TYPE)
              return updateSlot(
                returnFiber,
                oldFiber,
                readContextDuringReconciliation(returnFiber, newChild),
                lanes
              );
            throwOnInvalidObjectTypeImpl(returnFiber, newChild);
          }
          return null;
        }
        function updateFromMap(existingChildren, returnFiber, newIdx, newChild, lanes) {
          if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
            return existingChildren = existingChildren.get(newIdx) || null, updateTextNode(returnFiber, existingChildren, "" + newChild, lanes);
          if ("object" === typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                return existingChildren = existingChildren.get(
                  null === newChild.key ? newIdx : newChild.key
                ) || null, updateElement(returnFiber, existingChildren, newChild, lanes);
              case REACT_PORTAL_TYPE:
                return existingChildren = existingChildren.get(
                  null === newChild.key ? newIdx : newChild.key
                ) || null, updatePortal(returnFiber, existingChildren, newChild, lanes);
              case REACT_LAZY_TYPE:
                return newChild = resolveLazy(newChild), updateFromMap(
                  existingChildren,
                  returnFiber,
                  newIdx,
                  newChild,
                  lanes
                );
            }
            if (isArrayImpl(newChild) || getIteratorFn(newChild))
              return existingChildren = existingChildren.get(newIdx) || null, updateFragment(returnFiber, existingChildren, newChild, lanes, null);
            if ("function" === typeof newChild.then)
              return updateFromMap(
                existingChildren,
                returnFiber,
                newIdx,
                unwrapThenable(newChild),
                lanes
              );
            if (newChild.$$typeof === REACT_CONTEXT_TYPE)
              return updateFromMap(
                existingChildren,
                returnFiber,
                newIdx,
                readContextDuringReconciliation(returnFiber, newChild),
                lanes
              );
            throwOnInvalidObjectTypeImpl(returnFiber, newChild);
          }
          return null;
        }
        function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren, lanes) {
          for (var resultingFirstChild = null, previousNewFiber = null, oldFiber = currentFirstChild, newIdx = currentFirstChild = 0, nextOldFiber = null; null !== oldFiber && newIdx < newChildren.length; newIdx++) {
            oldFiber.index > newIdx ? (nextOldFiber = oldFiber, oldFiber = null) : nextOldFiber = oldFiber.sibling;
            var newFiber = updateSlot(
              returnFiber,
              oldFiber,
              newChildren[newIdx],
              lanes
            );
            if (null === newFiber) {
              null === oldFiber && (oldFiber = nextOldFiber);
              break;
            }
            shouldTrackSideEffects && oldFiber && null === newFiber.alternate && deleteChild(returnFiber, oldFiber);
            currentFirstChild = placeChild(newFiber, currentFirstChild, newIdx);
            null === previousNewFiber ? resultingFirstChild = newFiber : previousNewFiber.sibling = newFiber;
            previousNewFiber = newFiber;
            oldFiber = nextOldFiber;
          }
          if (newIdx === newChildren.length)
            return deleteRemainingChildren(returnFiber, oldFiber), isHydrating && pushTreeFork(returnFiber, newIdx), resultingFirstChild;
          if (null === oldFiber) {
            for (; newIdx < newChildren.length; newIdx++)
              oldFiber = createChild(returnFiber, newChildren[newIdx], lanes), null !== oldFiber && (currentFirstChild = placeChild(
                oldFiber,
                currentFirstChild,
                newIdx
              ), null === previousNewFiber ? resultingFirstChild = oldFiber : previousNewFiber.sibling = oldFiber, previousNewFiber = oldFiber);
            isHydrating && pushTreeFork(returnFiber, newIdx);
            return resultingFirstChild;
          }
          for (oldFiber = mapRemainingChildren(oldFiber); newIdx < newChildren.length; newIdx++)
            nextOldFiber = updateFromMap(
              oldFiber,
              returnFiber,
              newIdx,
              newChildren[newIdx],
              lanes
            ), null !== nextOldFiber && (shouldTrackSideEffects && (newFiber = nextOldFiber.alternate, null !== newFiber && oldFiber.delete(null === newFiber.key ? newIdx : newFiber.key)), currentFirstChild = placeChild(
              nextOldFiber,
              currentFirstChild,
              newIdx
            ), null === previousNewFiber ? resultingFirstChild = nextOldFiber : previousNewFiber.sibling = nextOldFiber, previousNewFiber = nextOldFiber);
          shouldTrackSideEffects && oldFiber.forEach(function(child) {
            return deleteChild(returnFiber, child);
          });
          isHydrating && pushTreeFork(returnFiber, newIdx);
          return resultingFirstChild;
        }
        function reconcileChildrenIterator(returnFiber, currentFirstChild, newChildren, lanes) {
          if (null == newChildren) throw Error(formatProdErrorMessage(151));
          for (var resultingFirstChild = null, previousNewFiber = null, oldFiber = currentFirstChild, newIdx = currentFirstChild = 0, nextOldFiber = null, step = newChildren.next(); null !== oldFiber && !step.done; newIdx++, step = newChildren.next()) {
            oldFiber.index > newIdx ? (nextOldFiber = oldFiber, oldFiber = null) : nextOldFiber = oldFiber.sibling;
            var newFiber = updateSlot(returnFiber, oldFiber, step.value, lanes);
            if (null === newFiber) {
              null === oldFiber && (oldFiber = nextOldFiber);
              break;
            }
            shouldTrackSideEffects && oldFiber && null === newFiber.alternate && deleteChild(returnFiber, oldFiber);
            currentFirstChild = placeChild(newFiber, currentFirstChild, newIdx);
            null === previousNewFiber ? resultingFirstChild = newFiber : previousNewFiber.sibling = newFiber;
            previousNewFiber = newFiber;
            oldFiber = nextOldFiber;
          }
          if (step.done)
            return deleteRemainingChildren(returnFiber, oldFiber), isHydrating && pushTreeFork(returnFiber, newIdx), resultingFirstChild;
          if (null === oldFiber) {
            for (; !step.done; newIdx++, step = newChildren.next())
              step = createChild(returnFiber, step.value, lanes), null !== step && (currentFirstChild = placeChild(step, currentFirstChild, newIdx), null === previousNewFiber ? resultingFirstChild = step : previousNewFiber.sibling = step, previousNewFiber = step);
            isHydrating && pushTreeFork(returnFiber, newIdx);
            return resultingFirstChild;
          }
          for (oldFiber = mapRemainingChildren(oldFiber); !step.done; newIdx++, step = newChildren.next())
            step = updateFromMap(oldFiber, returnFiber, newIdx, step.value, lanes), null !== step && (shouldTrackSideEffects && (nextOldFiber = step.alternate, null !== nextOldFiber && oldFiber.delete(
              null === nextOldFiber.key ? newIdx : nextOldFiber.key
            )), currentFirstChild = placeChild(step, currentFirstChild, newIdx), null === previousNewFiber ? resultingFirstChild = step : previousNewFiber.sibling = step, previousNewFiber = step);
          shouldTrackSideEffects && oldFiber.forEach(function(child) {
            return deleteChild(returnFiber, child);
          });
          isHydrating && pushTreeFork(returnFiber, newIdx);
          return resultingFirstChild;
        }
        function reconcileChildFibersImpl(returnFiber, currentFirstChild, newChild, lanes) {
          "object" === typeof newChild && null !== newChild && newChild.type === REACT_FRAGMENT_TYPE && null === newChild.key && void 0 === newChild.props.ref && (newChild = newChild.props.children);
          if ("object" === typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                a: {
                  for (var key = newChild.key; null !== currentFirstChild; ) {
                    if (currentFirstChild.key === key) {
                      key = newChild.type;
                      if (key === REACT_FRAGMENT_TYPE) {
                        if (7 === currentFirstChild.tag) {
                          deleteRemainingChildren(
                            returnFiber,
                            currentFirstChild.sibling
                          );
                          lanes = useFiber(
                            currentFirstChild,
                            newChild.props.children
                          );
                          coerceRef(lanes, newChild);
                          lanes.return = returnFiber;
                          returnFiber = lanes;
                          break a;
                        }
                      } else if (currentFirstChild.elementType === key || "object" === typeof key && null !== key && key.$$typeof === REACT_LAZY_TYPE && resolveLazy(key) === currentFirstChild.type) {
                        deleteRemainingChildren(
                          returnFiber,
                          currentFirstChild.sibling
                        );
                        lanes = useFiber(currentFirstChild, newChild.props);
                        coerceRef(lanes, newChild);
                        lanes.return = returnFiber;
                        returnFiber = lanes;
                        break a;
                      }
                      deleteRemainingChildren(returnFiber, currentFirstChild);
                      break;
                    } else deleteChild(returnFiber, currentFirstChild);
                    currentFirstChild = currentFirstChild.sibling;
                  }
                  newChild.type === REACT_FRAGMENT_TYPE ? (lanes = createFiberFromFragment(
                    newChild.props.children,
                    returnFiber.mode,
                    lanes,
                    newChild.key
                  ), coerceRef(lanes, newChild), lanes.return = returnFiber, returnFiber = lanes) : (lanes = createFiberFromTypeAndProps(
                    newChild.type,
                    newChild.key,
                    newChild.props,
                    null,
                    returnFiber.mode,
                    lanes
                  ), coerceRef(lanes, newChild), lanes.return = returnFiber, returnFiber = lanes);
                }
                return placeSingleChild(returnFiber);
              case REACT_PORTAL_TYPE:
                a: {
                  for (key = newChild.key; null !== currentFirstChild; ) {
                    if (currentFirstChild.key === key)
                      if (4 === currentFirstChild.tag && currentFirstChild.stateNode.containerInfo === newChild.containerInfo && currentFirstChild.stateNode.implementation === newChild.implementation) {
                        deleteRemainingChildren(
                          returnFiber,
                          currentFirstChild.sibling
                        );
                        lanes = useFiber(currentFirstChild, newChild.children || []);
                        lanes.return = returnFiber;
                        returnFiber = lanes;
                        break a;
                      } else {
                        deleteRemainingChildren(returnFiber, currentFirstChild);
                        break;
                      }
                    else deleteChild(returnFiber, currentFirstChild);
                    currentFirstChild = currentFirstChild.sibling;
                  }
                  lanes = createFiberFromPortal(newChild, returnFiber.mode, lanes);
                  lanes.return = returnFiber;
                  returnFiber = lanes;
                }
                return placeSingleChild(returnFiber);
              case REACT_LAZY_TYPE:
                return newChild = resolveLazy(newChild), reconcileChildFibersImpl(
                  returnFiber,
                  currentFirstChild,
                  newChild,
                  lanes
                );
            }
            if (isArrayImpl(newChild))
              return reconcileChildrenArray(
                returnFiber,
                currentFirstChild,
                newChild,
                lanes
              );
            if (getIteratorFn(newChild)) {
              key = getIteratorFn(newChild);
              if ("function" !== typeof key) throw Error(formatProdErrorMessage(150));
              newChild = key.call(newChild);
              return reconcileChildrenIterator(
                returnFiber,
                currentFirstChild,
                newChild,
                lanes
              );
            }
            if ("function" === typeof newChild.then)
              return reconcileChildFibersImpl(
                returnFiber,
                currentFirstChild,
                unwrapThenable(newChild),
                lanes
              );
            if (newChild.$$typeof === REACT_CONTEXT_TYPE)
              return reconcileChildFibersImpl(
                returnFiber,
                currentFirstChild,
                readContextDuringReconciliation(returnFiber, newChild),
                lanes
              );
            throwOnInvalidObjectTypeImpl(returnFiber, newChild);
          }
          return "string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild ? (newChild = "" + newChild, null !== currentFirstChild && 6 === currentFirstChild.tag ? (deleteRemainingChildren(returnFiber, currentFirstChild.sibling), lanes = useFiber(currentFirstChild, newChild), lanes.return = returnFiber, returnFiber = lanes) : (deleteRemainingChildren(returnFiber, currentFirstChild), lanes = createFiberFromText(newChild, returnFiber.mode, lanes), lanes.return = returnFiber, returnFiber = lanes), placeSingleChild(returnFiber)) : deleteRemainingChildren(returnFiber, currentFirstChild);
        }
        return function(returnFiber, currentFirstChild, newChild, lanes) {
          try {
            thenableIndexCounter$1 = 0;
            var firstChildFiber = reconcileChildFibersImpl(
              returnFiber,
              currentFirstChild,
              newChild,
              lanes
            );
            thenableState$1 = null;
            return firstChildFiber;
          } catch (x) {
            if (x === SuspenseException || x === SuspenseActionException) throw x;
            var fiber = createFiberImplClass(29, x, null, returnFiber.mode);
            fiber.lanes = lanes;
            fiber.return = returnFiber;
            return fiber;
          } finally {
          }
        };
      }
      var reconcileChildFibers = createChildReconciler(true);
      var mountChildFibers = createChildReconciler(false);
      var hasForceUpdate = false;
      function initializeUpdateQueue(fiber) {
        fiber.updateQueue = {
          baseState: fiber.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function cloneUpdateQueue(current, workInProgress2) {
        current = current.updateQueue;
        workInProgress2.updateQueue === current && (workInProgress2.updateQueue = {
          baseState: current.baseState,
          firstBaseUpdate: current.firstBaseUpdate,
          lastBaseUpdate: current.lastBaseUpdate,
          shared: current.shared,
          callbacks: null
        });
      }
      function createUpdate(lane) {
        return { lane, tag: 0, payload: null, callback: null, next: null };
      }
      function enqueueUpdate(fiber, update, lane) {
        var updateQueue = fiber.updateQueue;
        if (null === updateQueue) return null;
        updateQueue = updateQueue.shared;
        if (0 !== (executionContext & 2)) {
          var pending = updateQueue.pending;
          null === pending ? update.next = update : (update.next = pending.next, pending.next = update);
          updateQueue.pending = update;
          update = getRootForUpdatedFiber(fiber);
          markUpdateLaneFromFiberToRoot(fiber, null, lane);
          return update;
        }
        enqueueUpdate$1(fiber, updateQueue, update, lane);
        return getRootForUpdatedFiber(fiber);
      }
      function entangleTransitions(root2, fiber, lane) {
        fiber = fiber.updateQueue;
        if (null !== fiber && (fiber = fiber.shared, 0 !== (lane & 4194048))) {
          var queueLanes = fiber.lanes;
          queueLanes &= root2.pendingLanes;
          lane |= queueLanes;
          fiber.lanes = lane;
          markRootEntangled(root2, lane);
        }
      }
      function enqueueCapturedUpdate(workInProgress2, capturedUpdate) {
        var queue = workInProgress2.updateQueue, current = workInProgress2.alternate;
        if (null !== current && (current = current.updateQueue, queue === current)) {
          var newFirst = null, newLast = null;
          queue = queue.firstBaseUpdate;
          if (null !== queue) {
            do {
              var clone = {
                lane: queue.lane,
                tag: queue.tag,
                payload: queue.payload,
                callback: null,
                next: null
              };
              null === newLast ? newFirst = newLast = clone : newLast = newLast.next = clone;
              queue = queue.next;
            } while (null !== queue);
            null === newLast ? newFirst = newLast = capturedUpdate : newLast = newLast.next = capturedUpdate;
          } else newFirst = newLast = capturedUpdate;
          queue = {
            baseState: current.baseState,
            firstBaseUpdate: newFirst,
            lastBaseUpdate: newLast,
            shared: current.shared,
            callbacks: current.callbacks
          };
          workInProgress2.updateQueue = queue;
          return;
        }
        workInProgress2 = queue.lastBaseUpdate;
        null === workInProgress2 ? queue.firstBaseUpdate = capturedUpdate : workInProgress2.next = capturedUpdate;
        queue.lastBaseUpdate = capturedUpdate;
      }
      var didReadFromEntangledAsyncAction = false;
      function suspendIfUpdateReadFromEntangledAsyncAction() {
        if (didReadFromEntangledAsyncAction) {
          var entangledActionThenable = currentEntangledActionThenable;
          if (null !== entangledActionThenable) throw entangledActionThenable;
        }
      }
      function processUpdateQueue(workInProgress$jscomp$0, props, instance$jscomp$0, renderLanes2) {
        didReadFromEntangledAsyncAction = false;
        var queue = workInProgress$jscomp$0.updateQueue;
        hasForceUpdate = false;
        var firstBaseUpdate = queue.firstBaseUpdate, lastBaseUpdate = queue.lastBaseUpdate, pendingQueue = queue.shared.pending;
        if (null !== pendingQueue) {
          queue.shared.pending = null;
          var lastPendingUpdate = pendingQueue, firstPendingUpdate = lastPendingUpdate.next;
          lastPendingUpdate.next = null;
          null === lastBaseUpdate ? firstBaseUpdate = firstPendingUpdate : lastBaseUpdate.next = firstPendingUpdate;
          lastBaseUpdate = lastPendingUpdate;
          var current = workInProgress$jscomp$0.alternate;
          null !== current && (current = current.updateQueue, pendingQueue = current.lastBaseUpdate, pendingQueue !== lastBaseUpdate && (null === pendingQueue ? current.firstBaseUpdate = firstPendingUpdate : pendingQueue.next = firstPendingUpdate, current.lastBaseUpdate = lastPendingUpdate));
        }
        if (null !== firstBaseUpdate) {
          var newState = queue.baseState;
          lastBaseUpdate = 0;
          current = firstPendingUpdate = lastPendingUpdate = null;
          pendingQueue = firstBaseUpdate;
          do {
            var updateLane = pendingQueue.lane & -536870913, isHiddenUpdate = updateLane !== pendingQueue.lane;
            if (isHiddenUpdate ? (workInProgressRootRenderLanes & updateLane) === updateLane : (renderLanes2 & updateLane) === updateLane) {
              0 !== updateLane && updateLane === currentEntangledLane && (didReadFromEntangledAsyncAction = true);
              null !== current && (current = current.next = {
                lane: 0,
                tag: pendingQueue.tag,
                payload: pendingQueue.payload,
                callback: null,
                next: null
              });
              a: {
                var workInProgress2 = workInProgress$jscomp$0, update = pendingQueue;
                updateLane = props;
                var instance = instance$jscomp$0;
                switch (update.tag) {
                  case 1:
                    workInProgress2 = update.payload;
                    if ("function" === typeof workInProgress2) {
                      newState = workInProgress2.call(instance, newState, updateLane);
                      break a;
                    }
                    newState = workInProgress2;
                    break a;
                  case 3:
                    workInProgress2.flags = workInProgress2.flags & -65537 | 128;
                  case 0:
                    workInProgress2 = update.payload;
                    updateLane = "function" === typeof workInProgress2 ? workInProgress2.call(instance, newState, updateLane) : workInProgress2;
                    if (null === updateLane || void 0 === updateLane) break a;
                    newState = assign({}, newState, updateLane);
                    break a;
                  case 2:
                    hasForceUpdate = true;
                }
              }
              updateLane = pendingQueue.callback;
              null !== updateLane && (workInProgress$jscomp$0.flags |= 64, isHiddenUpdate && (workInProgress$jscomp$0.flags |= 8192), isHiddenUpdate = queue.callbacks, null === isHiddenUpdate ? queue.callbacks = [updateLane] : isHiddenUpdate.push(updateLane));
            } else
              isHiddenUpdate = {
                lane: updateLane,
                tag: pendingQueue.tag,
                payload: pendingQueue.payload,
                callback: pendingQueue.callback,
                next: null
              }, null === current ? (firstPendingUpdate = current = isHiddenUpdate, lastPendingUpdate = newState) : current = current.next = isHiddenUpdate, lastBaseUpdate |= updateLane;
            pendingQueue = pendingQueue.next;
            if (null === pendingQueue)
              if (pendingQueue = queue.shared.pending, null === pendingQueue)
                break;
              else
                isHiddenUpdate = pendingQueue, pendingQueue = isHiddenUpdate.next, isHiddenUpdate.next = null, queue.lastBaseUpdate = isHiddenUpdate, queue.shared.pending = null;
          } while (1);
          null === current && (lastPendingUpdate = newState);
          queue.baseState = lastPendingUpdate;
          queue.firstBaseUpdate = firstPendingUpdate;
          queue.lastBaseUpdate = current;
          null === firstBaseUpdate && (queue.shared.lanes = 0);
          workInProgressRootSkippedLanes |= lastBaseUpdate;
          workInProgress$jscomp$0.lanes = lastBaseUpdate;
          workInProgress$jscomp$0.memoizedState = newState;
        }
      }
      function callCallback(callback, context) {
        if ("function" !== typeof callback)
          throw Error(formatProdErrorMessage(191, callback));
        callback.call(context);
      }
      function commitCallbacks(updateQueue, context) {
        var callbacks = updateQueue.callbacks;
        if (null !== callbacks)
          for (updateQueue.callbacks = null, updateQueue = 0; updateQueue < callbacks.length; updateQueue++)
            callCallback(callbacks[updateQueue], context);
      }
      var currentTreeHiddenStackCursor = createCursor(null);
      var prevEntangledRenderLanesCursor = createCursor(0);
      function pushHiddenContext(fiber, context) {
        fiber = entangledRenderLanes;
        push(prevEntangledRenderLanesCursor, fiber);
        push(currentTreeHiddenStackCursor, context);
        entangledRenderLanes = fiber | context.baseLanes;
      }
      function reuseHiddenContextOnStack() {
        push(prevEntangledRenderLanesCursor, entangledRenderLanes);
        push(currentTreeHiddenStackCursor, currentTreeHiddenStackCursor.current);
      }
      function popHiddenContext() {
        entangledRenderLanes = prevEntangledRenderLanesCursor.current;
        pop(currentTreeHiddenStackCursor);
        pop(prevEntangledRenderLanesCursor);
      }
      var suspenseHandlerStackCursor = createCursor(null);
      var shellBoundary = null;
      function pushPrimaryTreeSuspenseHandler(handler) {
        var current = handler.alternate;
        push(suspenseStackCursor, suspenseStackCursor.current & 1);
        push(suspenseHandlerStackCursor, handler);
        null === shellBoundary && (null === current || null !== currentTreeHiddenStackCursor.current ? shellBoundary = handler : null !== current.memoizedState && (shellBoundary = handler));
      }
      function pushDehydratedActivitySuspenseHandler(fiber) {
        push(suspenseStackCursor, suspenseStackCursor.current);
        push(suspenseHandlerStackCursor, fiber);
        null === shellBoundary && (shellBoundary = fiber);
      }
      function pushOffscreenSuspenseHandler(fiber) {
        22 === fiber.tag ? (push(suspenseStackCursor, suspenseStackCursor.current), push(suspenseHandlerStackCursor, fiber), null === shellBoundary && (shellBoundary = fiber)) : reuseSuspenseHandlerOnStack();
      }
      function reuseSuspenseHandlerOnStack() {
        push(suspenseStackCursor, suspenseStackCursor.current);
        push(suspenseHandlerStackCursor, suspenseHandlerStackCursor.current);
      }
      function popSuspenseHandler(fiber) {
        pop(suspenseHandlerStackCursor);
        shellBoundary === fiber && (shellBoundary = null);
        pop(suspenseStackCursor);
      }
      var suspenseStackCursor = createCursor(0);
      function pushSuspenseListContext(fiber, newContext) {
        push(suspenseHandlerStackCursor, suspenseHandlerStackCursor.current);
        push(suspenseStackCursor, newContext);
      }
      function popSuspenseListContext(fiber) {
        pop(suspenseStackCursor);
        pop(suspenseHandlerStackCursor);
        shellBoundary === fiber && (shellBoundary = null);
      }
      function findFirstSuspended(row) {
        for (var node = row; null !== node; ) {
          if (13 === node.tag) {
            var state = node.memoizedState;
            if (null !== state && (state = state.dehydrated, null === state || isSuspenseInstancePending(state) || isSuspenseInstanceFallback(state)))
              return node;
          } else if (19 === node.tag && "independent" !== node.memoizedProps.revealOrder) {
            if (0 !== (node.flags & 128)) return node;
          } else if (null !== node.child) {
            node.child.return = node;
            node = node.child;
            continue;
          }
          if (node === row) break;
          for (; null === node.sibling; ) {
            if (null === node.return || node.return === row) return null;
            node = node.return;
          }
          node.sibling.return = node.return;
          node = node.sibling;
        }
        return null;
      }
      var renderLanes = 0;
      var currentlyRenderingFiber = null;
      var currentHook = null;
      var workInProgressHook = null;
      var didScheduleRenderPhaseUpdate = false;
      var didScheduleRenderPhaseUpdateDuringThisPass = false;
      var shouldDoubleInvokeUserFnsInHooksDEV = false;
      var localIdCounter = 0;
      var thenableIndexCounter = 0;
      var thenableState = null;
      var globalClientIdCounter = 0;
      function throwInvalidHookError() {
        throw Error(formatProdErrorMessage(321));
      }
      function areHookInputsEqual(nextDeps, prevDeps) {
        if (null === prevDeps) return false;
        for (var i = 0; i < prevDeps.length && i < nextDeps.length; i++)
          if (!objectIs(nextDeps[i], prevDeps[i])) return false;
        return true;
      }
      function renderWithHooks(current, workInProgress2, Component, props, secondArg, nextRenderLanes) {
        renderLanes = nextRenderLanes;
        currentlyRenderingFiber = workInProgress2;
        workInProgress2.memoizedState = null;
        workInProgress2.updateQueue = null;
        workInProgress2.lanes = 0;
        ReactSharedInternals.H = null === current || null === current.memoizedState ? HooksDispatcherOnMount : HooksDispatcherOnUpdate;
        shouldDoubleInvokeUserFnsInHooksDEV = false;
        nextRenderLanes = Component(props, secondArg);
        shouldDoubleInvokeUserFnsInHooksDEV = false;
        didScheduleRenderPhaseUpdateDuringThisPass && (nextRenderLanes = renderWithHooksAgain(
          workInProgress2,
          Component,
          props,
          secondArg
        ));
        finishRenderingHooks(current);
        return nextRenderLanes;
      }
      function finishRenderingHooks(current) {
        ReactSharedInternals.H = ContextOnlyDispatcher;
        var didRenderTooFewHooks = null !== currentHook && null !== currentHook.next;
        renderLanes = 0;
        workInProgressHook = currentHook = currentlyRenderingFiber = null;
        didScheduleRenderPhaseUpdate = false;
        thenableIndexCounter = 0;
        thenableState = null;
        if (didRenderTooFewHooks) throw Error(formatProdErrorMessage(300));
        null === current || didReceiveUpdate || (current = current.dependencies, null !== current && checkIfContextChanged(current) && (didReceiveUpdate = true));
      }
      function renderWithHooksAgain(workInProgress2, Component, props, secondArg) {
        currentlyRenderingFiber = workInProgress2;
        var numberOfReRenders = 0;
        do {
          didScheduleRenderPhaseUpdateDuringThisPass && (thenableState = null);
          thenableIndexCounter = 0;
          didScheduleRenderPhaseUpdateDuringThisPass = false;
          if (25 <= numberOfReRenders) throw Error(formatProdErrorMessage(301));
          numberOfReRenders += 1;
          workInProgressHook = currentHook = null;
          if (null != workInProgress2.updateQueue) {
            var children = workInProgress2.updateQueue;
            children.lastEffect = null;
            children.events = null;
            children.stores = null;
            null != children.memoCache && (children.memoCache.index = 0);
          }
          ReactSharedInternals.H = HooksDispatcherOnRerender;
          children = Component(props, secondArg);
        } while (didScheduleRenderPhaseUpdateDuringThisPass);
        return children;
      }
      function TransitionAwareHostComponent() {
        var dispatcher = ReactSharedInternals.H, maybeThenable = dispatcher.useState()[0];
        maybeThenable = "function" === typeof maybeThenable.then ? useThenable(maybeThenable) : maybeThenable;
        dispatcher = dispatcher.useState()[0];
        (null !== currentHook ? currentHook.memoizedState : null) !== dispatcher && (currentlyRenderingFiber.flags |= 1024);
        return maybeThenable;
      }
      function checkDidRenderIdHook() {
        var didRenderIdHook = 0 !== localIdCounter;
        localIdCounter = 0;
        return didRenderIdHook;
      }
      function bailoutHooks(current, workInProgress2, lanes) {
        workInProgress2.updateQueue = current.updateQueue;
        workInProgress2.flags &= -2053;
        current.lanes &= ~lanes;
      }
      function resetHooksOnUnwind(workInProgress2) {
        if (didScheduleRenderPhaseUpdate) {
          for (workInProgress2 = workInProgress2.memoizedState; null !== workInProgress2; ) {
            var queue = workInProgress2.queue;
            null !== queue && (queue.pending = null);
            workInProgress2 = workInProgress2.next;
          }
          didScheduleRenderPhaseUpdate = false;
        }
        renderLanes = 0;
        workInProgressHook = currentHook = currentlyRenderingFiber = null;
        didScheduleRenderPhaseUpdateDuringThisPass = false;
        thenableIndexCounter = localIdCounter = 0;
        thenableState = null;
      }
      function mountWorkInProgressHook() {
        var hook = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        null === workInProgressHook ? currentlyRenderingFiber.memoizedState = workInProgressHook = hook : workInProgressHook = workInProgressHook.next = hook;
        return workInProgressHook;
      }
      function updateWorkInProgressHook() {
        if (null === currentHook) {
          var nextCurrentHook = currentlyRenderingFiber.alternate;
          nextCurrentHook = null !== nextCurrentHook ? nextCurrentHook.memoizedState : null;
        } else nextCurrentHook = currentHook.next;
        var nextWorkInProgressHook = null === workInProgressHook ? currentlyRenderingFiber.memoizedState : workInProgressHook.next;
        if (null !== nextWorkInProgressHook)
          workInProgressHook = nextWorkInProgressHook, currentHook = nextCurrentHook;
        else {
          if (null === nextCurrentHook) {
            if (null === currentlyRenderingFiber.alternate)
              throw Error(formatProdErrorMessage(467));
            throw Error(formatProdErrorMessage(310));
          }
          currentHook = nextCurrentHook;
          nextCurrentHook = {
            memoizedState: currentHook.memoizedState,
            baseState: currentHook.baseState,
            baseQueue: currentHook.baseQueue,
            queue: currentHook.queue,
            next: null
          };
          null === workInProgressHook ? currentlyRenderingFiber.memoizedState = workInProgressHook = nextCurrentHook : workInProgressHook = workInProgressHook.next = nextCurrentHook;
        }
        return workInProgressHook;
      }
      function createFunctionComponentUpdateQueue() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function useThenable(thenable) {
        var index2 = thenableIndexCounter;
        thenableIndexCounter += 1;
        null === thenableState && (thenableState = []);
        thenable = trackUsedThenable(thenableState, thenable, index2);
        index2 = currentlyRenderingFiber;
        null === (null === workInProgressHook ? index2.memoizedState : workInProgressHook.next) && (index2 = index2.alternate, ReactSharedInternals.H = null === index2 || null === index2.memoizedState ? HooksDispatcherOnMount : HooksDispatcherOnUpdate);
        return thenable;
      }
      function use(usable) {
        if (null !== usable && "object" === typeof usable) {
          if ("function" === typeof usable.then) return useThenable(usable);
          if (usable.$$typeof === REACT_RECOVERABLE_TYPE) return;
          if (usable.$$typeof === REACT_CONTEXT_TYPE) return readContext(usable);
        }
        throw Error(formatProdErrorMessage(438, String(usable)));
      }
      function useMemoCache(size) {
        var memoCache = null, updateQueue = currentlyRenderingFiber.updateQueue;
        null !== updateQueue && (memoCache = updateQueue.memoCache);
        if (null == memoCache) {
          var current = currentlyRenderingFiber.alternate;
          null !== current && (current = current.updateQueue, null !== current && (current = current.memoCache, null != current && (memoCache = {
            data: current.data.map(function(array) {
              return array.slice();
            }),
            index: 0
          })));
        }
        null == memoCache && (memoCache = { data: [], index: 0 });
        null === updateQueue && (updateQueue = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = updateQueue);
        updateQueue.memoCache = memoCache;
        updateQueue = memoCache.data[memoCache.index];
        if (void 0 === updateQueue)
          for (updateQueue = memoCache.data[memoCache.index] = Array(size), current = 0; current < size; current++)
            updateQueue[current] = REACT_MEMO_CACHE_SENTINEL;
        memoCache.index++;
        return updateQueue;
      }
      function basicStateReducer(state, action) {
        return "function" === typeof action ? action(state) : action;
      }
      function updateReducer(reducer) {
        var hook = updateWorkInProgressHook();
        return updateReducerImpl(hook, currentHook, reducer);
      }
      function updateReducerImpl(hook, current, reducer) {
        var queue = hook.queue;
        if (null === queue) throw Error(formatProdErrorMessage(311));
        queue.lastRenderedReducer = reducer;
        var baseQueue = hook.baseQueue, pendingQueue = queue.pending;
        if (null !== pendingQueue) {
          if (null !== baseQueue) {
            var baseFirst = baseQueue.next;
            baseQueue.next = pendingQueue.next;
            pendingQueue.next = baseFirst;
          }
          current.baseQueue = baseQueue = pendingQueue;
          queue.pending = null;
        }
        pendingQueue = hook.baseState;
        if (null === baseQueue) hook.memoizedState = pendingQueue;
        else {
          current = baseQueue.next;
          var newBaseQueueFirst = baseFirst = null, newBaseQueueLast = null, update = current, didReadFromEntangledAsyncAction$64 = false;
          do {
            var updateLane = update.lane & -536870913;
            if (updateLane !== update.lane ? (workInProgressRootRenderLanes & updateLane) === updateLane : (renderLanes & updateLane) === updateLane) {
              var revertLane = update.revertLane;
              if (0 === revertLane)
                null !== newBaseQueueLast && (newBaseQueueLast = newBaseQueueLast.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: update.action,
                  hasEagerState: update.hasEagerState,
                  eagerState: update.eagerState,
                  next: null
                }), updateLane === currentEntangledLane && (didReadFromEntangledAsyncAction$64 = true);
              else if ((renderLanes & revertLane) === revertLane) {
                update = update.next;
                revertLane === currentEntangledLane && (didReadFromEntangledAsyncAction$64 = true);
                continue;
              } else
                updateLane = {
                  lane: 0,
                  revertLane: update.revertLane,
                  gesture: null,
                  action: update.action,
                  hasEagerState: update.hasEagerState,
                  eagerState: update.eagerState,
                  next: null
                }, null === newBaseQueueLast ? (newBaseQueueFirst = newBaseQueueLast = updateLane, baseFirst = pendingQueue) : newBaseQueueLast = newBaseQueueLast.next = updateLane, currentlyRenderingFiber.lanes |= revertLane, workInProgressRootSkippedLanes |= revertLane;
              updateLane = update.action;
              shouldDoubleInvokeUserFnsInHooksDEV && reducer(pendingQueue, updateLane);
              pendingQueue = update.hasEagerState ? update.eagerState : reducer(pendingQueue, updateLane);
            } else
              revertLane = {
                lane: updateLane,
                revertLane: update.revertLane,
                gesture: update.gesture,
                action: update.action,
                hasEagerState: update.hasEagerState,
                eagerState: update.eagerState,
                next: null
              }, null === newBaseQueueLast ? (newBaseQueueFirst = newBaseQueueLast = revertLane, baseFirst = pendingQueue) : newBaseQueueLast = newBaseQueueLast.next = revertLane, currentlyRenderingFiber.lanes |= updateLane, workInProgressRootSkippedLanes |= updateLane;
            update = update.next;
          } while (null !== update && update !== current);
          null === newBaseQueueLast ? baseFirst = pendingQueue : newBaseQueueLast.next = newBaseQueueFirst;
          if (!objectIs(pendingQueue, hook.memoizedState) && (didReceiveUpdate = true, didReadFromEntangledAsyncAction$64 && (reducer = currentEntangledActionThenable, null !== reducer)))
            throw reducer;
          hook.memoizedState = pendingQueue;
          hook.baseState = baseFirst;
          hook.baseQueue = newBaseQueueLast;
          queue.lastRenderedState = pendingQueue;
        }
        null === baseQueue && (queue.lanes = 0);
        return [hook.memoizedState, queue.dispatch];
      }
      function rerenderReducer(reducer) {
        var hook = updateWorkInProgressHook(), queue = hook.queue;
        if (null === queue) throw Error(formatProdErrorMessage(311));
        queue.lastRenderedReducer = reducer;
        var dispatch = queue.dispatch, lastRenderPhaseUpdate = queue.pending, newState = hook.memoizedState;
        if (null !== lastRenderPhaseUpdate) {
          queue.pending = null;
          var update = lastRenderPhaseUpdate = lastRenderPhaseUpdate.next;
          do
            newState = reducer(newState, update.action), update = update.next;
          while (update !== lastRenderPhaseUpdate);
          objectIs(newState, hook.memoizedState) || (didReceiveUpdate = true);
          hook.memoizedState = newState;
          null === hook.baseQueue && (hook.baseState = newState);
          queue.lastRenderedState = newState;
        }
        return [newState, dispatch];
      }
      function updateSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
        var fiber = currentlyRenderingFiber, hook = updateWorkInProgressHook(), isHydrating$jscomp$0 = isHydrating;
        if (isHydrating$jscomp$0) {
          if (void 0 === getServerSnapshot) throw Error(formatProdErrorMessage(407));
          getServerSnapshot = getServerSnapshot();
        } else getServerSnapshot = getSnapshot();
        var snapshotChanged = !objectIs(
          (currentHook || hook).memoizedState,
          getServerSnapshot
        );
        snapshotChanged && (hook.memoizedState = getServerSnapshot, didReceiveUpdate = true);
        hook = hook.queue;
        updateEffect(subscribeToStore.bind(null, fiber, hook, subscribe), [
          subscribe
        ]);
        subscribe = hook.getSnapshot !== getSnapshot || snapshotChanged || null !== workInProgressHook && 0 !== (workInProgressHook.memoizedState.tag & 1);
        pushSimpleEffect(
          subscribe ? 9 : 8,
          { destroy: void 0 },
          updateStoreInstance.bind(null, fiber, hook, getServerSnapshot, getSnapshot),
          null
        );
        if (subscribe) {
          fiber.flags |= 2048;
          if (null === workInProgressRoot) throw Error(formatProdErrorMessage(349));
          isHydrating$jscomp$0 || 0 !== (renderLanes & 127) || pushStoreConsistencyCheck(fiber, getSnapshot, getServerSnapshot);
        }
        return getServerSnapshot;
      }
      function pushStoreConsistencyCheck(fiber, getSnapshot, renderedSnapshot) {
        fiber.flags |= 16384;
        fiber = { getSnapshot, value: renderedSnapshot };
        getSnapshot = currentlyRenderingFiber.updateQueue;
        null === getSnapshot ? (getSnapshot = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = getSnapshot, getSnapshot.stores = [fiber]) : (renderedSnapshot = getSnapshot.stores, null === renderedSnapshot ? getSnapshot.stores = [fiber] : renderedSnapshot.push(fiber));
      }
      function updateStoreInstance(fiber, inst, nextSnapshot, getSnapshot) {
        inst.value = nextSnapshot;
        inst.getSnapshot = getSnapshot;
        checkIfSnapshotChanged(inst) && forceStoreRerender(fiber);
      }
      function subscribeToStore(fiber, inst, subscribe) {
        return subscribe(function() {
          checkIfSnapshotChanged(inst) && forceStoreRerender(fiber);
        });
      }
      function checkIfSnapshotChanged(inst) {
        var latestGetSnapshot = inst.getSnapshot;
        inst = inst.value;
        try {
          var nextValue = latestGetSnapshot();
          return !objectIs(inst, nextValue);
        } catch (error) {
          return true;
        }
      }
      function forceStoreRerender(fiber) {
        var root2 = enqueueConcurrentRenderForLane(fiber, 2);
        null !== root2 && scheduleUpdateOnFiber(root2, fiber, 2);
      }
      function mountStateImpl(initialState) {
        var hook = mountWorkInProgressHook();
        if ("function" === typeof initialState) {
          var initialStateInitializer = initialState;
          initialState = initialStateInitializer();
          if (shouldDoubleInvokeUserFnsInHooksDEV) {
            setIsStrictModeForDevtools(true);
            try {
              initialStateInitializer();
            } finally {
              setIsStrictModeForDevtools(false);
            }
          }
        }
        hook.memoizedState = hook.baseState = initialState;
        hook.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: basicStateReducer,
          lastRenderedState: initialState
        };
        return hook;
      }
      function updateOptimisticImpl(hook, current, passthrough, reducer) {
        hook.baseState = passthrough;
        return updateReducerImpl(
          hook,
          currentHook,
          "function" === typeof reducer ? reducer : basicStateReducer
        );
      }
      function dispatchActionState(fiber, actionQueue, setPendingState, setState, payload) {
        if (isRenderPhaseUpdate(fiber)) throw Error(formatProdErrorMessage(485));
        fiber = actionQueue.action;
        if (null !== fiber) {
          var actionNode = {
            payload,
            action: fiber,
            next: null,
            isTransition: true,
            status: "pending",
            value: null,
            reason: null,
            listeners: [],
            then: function(listener) {
              actionNode.listeners.push(listener);
            }
          };
          null !== ReactSharedInternals.T ? setPendingState(true) : actionNode.isTransition = false;
          setState(actionNode);
          setPendingState = actionQueue.pending;
          null === setPendingState ? (actionNode.next = actionQueue.pending = actionNode, runActionStateAction(actionQueue, actionNode)) : (actionNode.next = setPendingState.next, actionQueue.pending = setPendingState.next = actionNode);
        }
      }
      function runActionStateAction(actionQueue, node) {
        var action = node.action, payload = node.payload, prevState = actionQueue.state;
        if (node.isTransition) {
          var prevTransition = ReactSharedInternals.T, currentTransition = {};
          currentTransition.types = null !== prevTransition ? prevTransition.types : null;
          ReactSharedInternals.T = currentTransition;
          try {
            var returnValue = action(prevState, payload), onStartTransitionFinish = ReactSharedInternals.S;
            null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
            handleActionReturnValue(actionQueue, node, returnValue);
          } catch (error) {
            onActionError(actionQueue, node, error);
          } finally {
            null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
          }
        } else
          try {
            prevTransition = action(prevState, payload), handleActionReturnValue(actionQueue, node, prevTransition);
          } catch (error$70) {
            onActionError(actionQueue, node, error$70);
          }
      }
      function handleActionReturnValue(actionQueue, node, returnValue) {
        null !== returnValue && "object" === typeof returnValue && "function" === typeof returnValue.then ? returnValue.then(
          function(nextState) {
            onActionSuccess(actionQueue, node, nextState);
          },
          function(error) {
            return onActionError(actionQueue, node, error);
          }
        ) : onActionSuccess(actionQueue, node, returnValue);
      }
      function onActionSuccess(actionQueue, actionNode, nextState) {
        actionNode.status = "fulfilled";
        actionNode.value = nextState;
        notifyActionListeners(actionNode);
        actionQueue.state = nextState;
        actionNode = actionQueue.pending;
        null !== actionNode && (nextState = actionNode.next, nextState === actionNode ? actionQueue.pending = null : (nextState = nextState.next, actionNode.next = nextState, runActionStateAction(actionQueue, nextState)));
      }
      function onActionError(actionQueue, actionNode, error) {
        var last = actionQueue.pending;
        actionQueue.pending = null;
        if (null !== last) {
          last = last.next;
          do
            actionNode.status = "rejected", actionNode.reason = error, notifyActionListeners(actionNode), actionNode = actionNode.next;
          while (actionNode !== last);
        }
        actionQueue.action = null;
      }
      function notifyActionListeners(actionNode) {
        actionNode = actionNode.listeners;
        for (var i = 0; i < actionNode.length; i++) (0, actionNode[i])();
      }
      function actionStateReducer(oldState, newState) {
        return newState;
      }
      function mountActionState(action, initialStateProp) {
        if (isHydrating) {
          var ssrFormState = workInProgressRoot.formState;
          if (null !== ssrFormState) {
            a: {
              var JSCompiler_inline_result = currentlyRenderingFiber;
              if (isHydrating) {
                if (nextHydratableInstance) {
                  b: {
                    var JSCompiler_inline_result$jscomp$0 = nextHydratableInstance;
                    for (var inRootOrSingleton = rootOrSingletonContext; 8 !== JSCompiler_inline_result$jscomp$0.nodeType; ) {
                      if (!inRootOrSingleton) {
                        JSCompiler_inline_result$jscomp$0 = null;
                        break b;
                      }
                      JSCompiler_inline_result$jscomp$0 = getNextHydratable(
                        JSCompiler_inline_result$jscomp$0.nextSibling
                      );
                      if (null === JSCompiler_inline_result$jscomp$0) {
                        JSCompiler_inline_result$jscomp$0 = null;
                        break b;
                      }
                    }
                    inRootOrSingleton = JSCompiler_inline_result$jscomp$0.data;
                    JSCompiler_inline_result$jscomp$0 = "F!" === inRootOrSingleton || "F" === inRootOrSingleton ? JSCompiler_inline_result$jscomp$0 : null;
                  }
                  if (JSCompiler_inline_result$jscomp$0) {
                    nextHydratableInstance = getNextHydratable(
                      JSCompiler_inline_result$jscomp$0.nextSibling
                    );
                    JSCompiler_inline_result = "F!" === JSCompiler_inline_result$jscomp$0.data;
                    break a;
                  }
                }
                throwOnHydrationMismatch(JSCompiler_inline_result);
              }
              JSCompiler_inline_result = false;
            }
            JSCompiler_inline_result && (initialStateProp = ssrFormState[0]);
          }
        }
        ssrFormState = mountWorkInProgressHook();
        ssrFormState.memoizedState = ssrFormState.baseState = initialStateProp;
        JSCompiler_inline_result = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: actionStateReducer,
          lastRenderedState: initialStateProp
        };
        ssrFormState.queue = JSCompiler_inline_result;
        ssrFormState = dispatchSetState.bind(
          null,
          currentlyRenderingFiber,
          JSCompiler_inline_result
        );
        JSCompiler_inline_result.dispatch = ssrFormState;
        JSCompiler_inline_result = mountStateImpl(false);
        inRootOrSingleton = dispatchOptimisticSetState.bind(
          null,
          currentlyRenderingFiber,
          false,
          JSCompiler_inline_result.queue
        );
        JSCompiler_inline_result = mountWorkInProgressHook();
        JSCompiler_inline_result$jscomp$0 = {
          state: initialStateProp,
          dispatch: null,
          action,
          pending: null
        };
        JSCompiler_inline_result.queue = JSCompiler_inline_result$jscomp$0;
        ssrFormState = dispatchActionState.bind(
          null,
          currentlyRenderingFiber,
          JSCompiler_inline_result$jscomp$0,
          inRootOrSingleton,
          ssrFormState
        );
        JSCompiler_inline_result$jscomp$0.dispatch = ssrFormState;
        JSCompiler_inline_result.memoizedState = action;
        return [initialStateProp, ssrFormState, false];
      }
      function updateActionState(action) {
        var stateHook = updateWorkInProgressHook();
        return updateActionStateImpl(stateHook, currentHook, action);
      }
      function updateActionStateImpl(stateHook, currentStateHook, action) {
        currentStateHook = updateReducerImpl(
          stateHook,
          currentStateHook,
          actionStateReducer
        )[0];
        stateHook = updateReducer(basicStateReducer)[0];
        if ("object" === typeof currentStateHook && null !== currentStateHook && "function" === typeof currentStateHook.then)
          try {
            var state = useThenable(currentStateHook);
          } catch (x) {
            if (x === SuspenseException) throw SuspenseActionException;
            throw x;
          }
        else state = currentStateHook;
        currentStateHook = updateWorkInProgressHook();
        var actionQueue = currentStateHook.queue, dispatch = actionQueue.dispatch;
        action !== currentStateHook.memoizedState && (currentlyRenderingFiber.flags |= 2048, pushSimpleEffect(
          9,
          { destroy: void 0 },
          actionStateActionEffect.bind(null, actionQueue, action),
          null
        ));
        return [state, dispatch, stateHook];
      }
      function actionStateActionEffect(actionQueue, action) {
        actionQueue.action = action;
      }
      function rerenderActionState(action) {
        var stateHook = updateWorkInProgressHook(), currentStateHook = currentHook;
        if (null !== currentStateHook)
          return updateActionStateImpl(stateHook, currentStateHook, action);
        updateWorkInProgressHook();
        stateHook = stateHook.memoizedState;
        currentStateHook = updateWorkInProgressHook();
        var dispatch = currentStateHook.queue.dispatch;
        currentStateHook.memoizedState = action;
        return [stateHook, dispatch, false];
      }
      function pushSimpleEffect(tag, inst, create, deps) {
        tag = { tag, create, deps, inst, next: null };
        inst = currentlyRenderingFiber.updateQueue;
        null === inst && (inst = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = inst);
        create = inst.lastEffect;
        null === create ? inst.lastEffect = tag.next = tag : (deps = create.next, create.next = tag, tag.next = deps, inst.lastEffect = tag);
        return tag;
      }
      function updateRef() {
        return updateWorkInProgressHook().memoizedState;
      }
      function mountEffectImpl(fiberFlags, hookFlags, create, deps) {
        var hook = mountWorkInProgressHook();
        currentlyRenderingFiber.flags |= fiberFlags;
        hook.memoizedState = pushSimpleEffect(
          1 | hookFlags,
          { destroy: void 0 },
          create,
          void 0 === deps ? null : deps
        );
      }
      function updateEffectImpl(fiberFlags, hookFlags, create, deps) {
        var hook = updateWorkInProgressHook();
        deps = void 0 === deps ? null : deps;
        var inst = hook.memoizedState.inst;
        null !== currentHook && null !== deps && areHookInputsEqual(deps, currentHook.memoizedState.deps) ? hook.memoizedState = pushSimpleEffect(hookFlags, inst, create, deps) : (currentlyRenderingFiber.flags |= fiberFlags, hook.memoizedState = pushSimpleEffect(
          1 | hookFlags,
          inst,
          create,
          deps
        ));
      }
      function mountEffect(create, deps) {
        mountEffectImpl(8390656, 8, create, deps);
      }
      function updateEffect(create, deps) {
        updateEffectImpl(2048, 8, create, deps);
      }
      function useEffectEventImpl(payload) {
        currentlyRenderingFiber.flags |= 4;
        var componentUpdateQueue = currentlyRenderingFiber.updateQueue;
        if (null === componentUpdateQueue)
          componentUpdateQueue = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = componentUpdateQueue, componentUpdateQueue.events = [payload];
        else {
          var events = componentUpdateQueue.events;
          null === events ? componentUpdateQueue.events = [payload] : events.push(payload);
        }
      }
      function updateEvent(callback) {
        var ref = updateWorkInProgressHook().memoizedState;
        useEffectEventImpl({ ref, nextImpl: callback });
        return function() {
          if (0 !== (executionContext & 2)) throw Error(formatProdErrorMessage(440));
          return ref.impl.apply(void 0, arguments);
        };
      }
      function updateInsertionEffect(create, deps) {
        return updateEffectImpl(4, 2, create, deps);
      }
      function updateLayoutEffect(create, deps) {
        return updateEffectImpl(4, 4, create, deps);
      }
      function imperativeHandleEffect(create, ref) {
        if ("function" === typeof ref) {
          create = create();
          var refCleanup = ref(create);
          return function() {
            "function" === typeof refCleanup ? refCleanup() : ref(null);
          };
        }
        if (null !== ref && void 0 !== ref)
          return create = create(), ref.current = create, function() {
            ref.current = null;
          };
      }
      function updateImperativeHandle(ref, create, deps) {
        deps = null !== deps && void 0 !== deps ? deps.concat([ref]) : null;
        updateEffectImpl(4, 4, imperativeHandleEffect.bind(null, create, ref), deps);
      }
      function mountDebugValue() {
      }
      function updateCallback(callback, deps) {
        var hook = updateWorkInProgressHook();
        deps = void 0 === deps ? null : deps;
        var prevState = hook.memoizedState;
        if (null !== deps && areHookInputsEqual(deps, prevState[1]))
          return prevState[0];
        hook.memoizedState = [callback, deps];
        return callback;
      }
      function updateMemo(nextCreate, deps) {
        var hook = updateWorkInProgressHook();
        deps = void 0 === deps ? null : deps;
        var prevState = hook.memoizedState;
        if (null !== deps && areHookInputsEqual(deps, prevState[1]))
          return prevState[0];
        prevState = nextCreate();
        if (shouldDoubleInvokeUserFnsInHooksDEV) {
          setIsStrictModeForDevtools(true);
          try {
            nextCreate();
          } finally {
            setIsStrictModeForDevtools(false);
          }
        }
        hook.memoizedState = [prevState, deps];
        return prevState;
      }
      function mountDeferredValueImpl(hook, value, initialValue) {
        if (void 0 === initialValue || 0 !== (renderLanes & 1073741824) && 0 === (workInProgressRootRenderLanes & 261930))
          return hook.memoizedState = value;
        hook.memoizedState = initialValue;
        hook = requestDeferredLane();
        currentlyRenderingFiber.lanes |= hook;
        workInProgressRootSkippedLanes |= hook;
        return initialValue;
      }
      function updateDeferredValueImpl(hook, prevValue, value, initialValue) {
        if (objectIs(value, prevValue)) return value;
        if (null !== currentTreeHiddenStackCursor.current)
          return hook = mountDeferredValueImpl(hook, value, initialValue), objectIs(hook, prevValue) || (didReceiveUpdate = true), hook;
        if (0 === (renderLanes & 106) || 0 !== (renderLanes & 1073741824) && 0 === (workInProgressRootRenderLanes & 261930))
          return didReceiveUpdate = true, hook.memoizedState = value;
        hook = requestDeferredLane();
        currentlyRenderingFiber.lanes |= hook;
        workInProgressRootSkippedLanes |= hook;
        return prevValue;
      }
      function startTransition(fiber, queue, pendingState, finishedState, callback) {
        var previousPriority = ReactDOMSharedInternals.p;
        ReactDOMSharedInternals.p = 0 !== previousPriority && 8 > previousPriority ? previousPriority : 8;
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        currentTransition.types = null !== prevTransition ? prevTransition.types : null;
        ReactSharedInternals.T = currentTransition;
        dispatchOptimisticSetState(fiber, false, queue, pendingState);
        try {
          var returnValue = callback(), onStartTransitionFinish = ReactSharedInternals.S;
          null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
          if (null !== returnValue && "object" === typeof returnValue && "function" === typeof returnValue.then) {
            var thenableForFinishedState = chainThenableValue(
              returnValue,
              finishedState
            );
            dispatchSetStateInternal(
              fiber,
              queue,
              thenableForFinishedState,
              requestUpdateLane(fiber)
            );
          } else
            dispatchSetStateInternal(
              fiber,
              queue,
              finishedState,
              requestUpdateLane(fiber)
            );
        } catch (error) {
          dispatchSetStateInternal(
            fiber,
            queue,
            { then: function() {
            }, status: "rejected", reason: error },
            requestUpdateLane()
          );
        } finally {
          ReactDOMSharedInternals.p = previousPriority, null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
        }
      }
      function noop() {
      }
      function startHostTransition(formFiber, pendingState, action, formData) {
        if (5 !== formFiber.tag) throw Error(formatProdErrorMessage(476));
        var queue = ensureFormComponentIsStateful(formFiber).queue;
        startTransition(
          formFiber,
          queue,
          pendingState,
          sharedNotPendingObject,
          null === action ? noop : function() {
            requestFormReset$1(formFiber);
            return action(formData);
          }
        );
      }
      function ensureFormComponentIsStateful(formFiber) {
        var existingStateHook = formFiber.memoizedState;
        if (null !== existingStateHook) return existingStateHook;
        existingStateHook = {
          memoizedState: sharedNotPendingObject,
          baseState: sharedNotPendingObject,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: basicStateReducer,
            lastRenderedState: sharedNotPendingObject
          },
          next: null
        };
        var initialResetState = {};
        existingStateHook.next = {
          memoizedState: initialResetState,
          baseState: initialResetState,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: basicStateReducer,
            lastRenderedState: initialResetState
          },
          next: null
        };
        formFiber.memoizedState = existingStateHook;
        formFiber = formFiber.alternate;
        null !== formFiber && (formFiber.memoizedState = existingStateHook);
        return existingStateHook;
      }
      function requestFormReset$1(formFiber) {
        var stateHook = ensureFormComponentIsStateful(formFiber);
        null === stateHook.next && (stateHook = formFiber.alternate.memoizedState);
        dispatchSetStateInternal(
          formFiber,
          stateHook.next.queue,
          {},
          requestUpdateLane()
        );
      }
      function useHostTransitionStatus() {
        return readContext(HostTransitionContext);
      }
      function updateId() {
        return updateWorkInProgressHook().memoizedState;
      }
      function updateRefresh() {
        return updateWorkInProgressHook().memoizedState;
      }
      function refreshCache(fiber) {
        for (var provider = fiber.return; null !== provider; ) {
          switch (provider.tag) {
            case 24:
            case 3:
              var lane = requestUpdateLane();
              fiber = createUpdate(lane);
              var root$73 = enqueueUpdate(provider, fiber, lane);
              null !== root$73 && (scheduleUpdateOnFiber(root$73, provider, lane), entangleTransitions(root$73, provider, lane));
              provider = { cache: createCache() };
              fiber.payload = provider;
              return;
          }
          provider = provider.return;
        }
      }
      function dispatchReducerAction(fiber, queue, action) {
        var lane = requestUpdateLane();
        action = {
          lane,
          revertLane: 0,
          gesture: null,
          action,
          hasEagerState: false,
          eagerState: null,
          next: null
        };
        isRenderPhaseUpdate(fiber) ? enqueueRenderPhaseUpdate(queue, action) : (action = enqueueConcurrentHookUpdate(fiber, queue, action, lane), null !== action && (scheduleUpdateOnFiber(action, fiber, lane), entangleTransitionUpdate(action, queue, lane)));
      }
      function dispatchSetState(fiber, queue, action) {
        var lane = requestUpdateLane();
        dispatchSetStateInternal(fiber, queue, action, lane);
      }
      function dispatchSetStateInternal(fiber, queue, action, lane) {
        var update = {
          lane,
          revertLane: 0,
          gesture: null,
          action,
          hasEagerState: false,
          eagerState: null,
          next: null
        };
        if (isRenderPhaseUpdate(fiber)) enqueueRenderPhaseUpdate(queue, update);
        else {
          var alternate = fiber.alternate;
          if (0 === fiber.lanes && (null === alternate || 0 === alternate.lanes) && (alternate = queue.lastRenderedReducer, null !== alternate))
            try {
              var currentState = queue.lastRenderedState, eagerState = alternate(currentState, action);
              update.hasEagerState = true;
              update.eagerState = eagerState;
              if (objectIs(eagerState, currentState))
                return enqueueUpdate$1(fiber, queue, update, 0), null === workInProgressRoot && finishQueueingConcurrentUpdates(), false;
            } catch (error) {
            } finally {
            }
          action = enqueueConcurrentHookUpdate(fiber, queue, update, lane);
          if (null !== action)
            return scheduleUpdateOnFiber(action, fiber, lane), entangleTransitionUpdate(action, queue, lane), true;
        }
        return false;
      }
      function dispatchOptimisticSetState(fiber, throwIfDuringRender, queue, action) {
        action = {
          lane: 2,
          revertLane: requestTransitionLane(),
          gesture: null,
          action,
          hasEagerState: false,
          eagerState: null,
          next: null
        };
        if (isRenderPhaseUpdate(fiber)) {
          if (throwIfDuringRender) throw Error(formatProdErrorMessage(479));
        } else
          throwIfDuringRender = enqueueConcurrentHookUpdate(
            fiber,
            queue,
            action,
            2
          ), null !== throwIfDuringRender && scheduleUpdateOnFiber(throwIfDuringRender, fiber, 2);
      }
      function isRenderPhaseUpdate(fiber) {
        var alternate = fiber.alternate;
        return fiber === currentlyRenderingFiber || null !== alternate && alternate === currentlyRenderingFiber;
      }
      function enqueueRenderPhaseUpdate(queue, update) {
        didScheduleRenderPhaseUpdateDuringThisPass = didScheduleRenderPhaseUpdate = true;
        var pending = queue.pending;
        null === pending ? update.next = update : (update.next = pending.next, pending.next = update);
        queue.pending = update;
      }
      function entangleTransitionUpdate(root2, queue, lane) {
        if (0 !== (lane & 4194048)) {
          var queueLanes = queue.lanes;
          queueLanes &= root2.pendingLanes;
          lane |= queueLanes;
          queue.lanes = lane;
          markRootEntangled(root2, lane);
        }
      }
      var ContextOnlyDispatcher = {
        readContext,
        use,
        useCallback: throwInvalidHookError,
        useContext: throwInvalidHookError,
        useEffect: throwInvalidHookError,
        useImperativeHandle: throwInvalidHookError,
        useLayoutEffect: throwInvalidHookError,
        useInsertionEffect: throwInvalidHookError,
        useMemo: throwInvalidHookError,
        useReducer: throwInvalidHookError,
        useRef: throwInvalidHookError,
        useState: throwInvalidHookError,
        useDebugValue: throwInvalidHookError,
        useDeferredValue: throwInvalidHookError,
        useTransition: throwInvalidHookError,
        useSyncExternalStore: throwInvalidHookError,
        useId: throwInvalidHookError,
        useHostTransitionStatus: throwInvalidHookError,
        useFormState: throwInvalidHookError,
        useActionState: throwInvalidHookError,
        useOptimistic: throwInvalidHookError,
        useMemoCache: throwInvalidHookError,
        useCacheRefresh: throwInvalidHookError,
        useEffectEvent: throwInvalidHookError
      };
      var HooksDispatcherOnMount = {
        readContext,
        use,
        useCallback: function(callback, deps) {
          mountWorkInProgressHook().memoizedState = [
            callback,
            void 0 === deps ? null : deps
          ];
          return callback;
        },
        useContext: readContext,
        useEffect: mountEffect,
        useImperativeHandle: function(ref, create, deps) {
          deps = null !== deps && void 0 !== deps ? deps.concat([ref]) : null;
          mountEffectImpl(
            4194308,
            4,
            imperativeHandleEffect.bind(null, create, ref),
            deps
          );
        },
        useLayoutEffect: function(create, deps) {
          return mountEffectImpl(4194308, 4, create, deps);
        },
        useInsertionEffect: function(create, deps) {
          mountEffectImpl(4, 2, create, deps);
        },
        useMemo: function(nextCreate, deps) {
          var hook = mountWorkInProgressHook();
          deps = void 0 === deps ? null : deps;
          var nextValue = nextCreate();
          if (shouldDoubleInvokeUserFnsInHooksDEV) {
            setIsStrictModeForDevtools(true);
            try {
              nextCreate();
            } finally {
              setIsStrictModeForDevtools(false);
            }
          }
          hook.memoizedState = [nextValue, deps];
          return nextValue;
        },
        useReducer: function(reducer, initialArg, init) {
          var hook = mountWorkInProgressHook();
          if (void 0 !== init) {
            var initialState = init(initialArg);
            if (shouldDoubleInvokeUserFnsInHooksDEV) {
              setIsStrictModeForDevtools(true);
              try {
                init(initialArg);
              } finally {
                setIsStrictModeForDevtools(false);
              }
            }
          } else initialState = initialArg;
          hook.memoizedState = hook.baseState = initialState;
          reducer = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: reducer,
            lastRenderedState: initialState
          };
          hook.queue = reducer;
          reducer = reducer.dispatch = dispatchReducerAction.bind(
            null,
            currentlyRenderingFiber,
            reducer
          );
          return [hook.memoizedState, reducer];
        },
        useRef: function(initialValue) {
          var hook = mountWorkInProgressHook();
          initialValue = { current: initialValue };
          return hook.memoizedState = initialValue;
        },
        useState: function(initialState) {
          initialState = mountStateImpl(initialState);
          var queue = initialState.queue, dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
          queue.dispatch = dispatch;
          return [initialState.memoizedState, dispatch];
        },
        useDebugValue: mountDebugValue,
        useDeferredValue: function(value, initialValue) {
          var hook = mountWorkInProgressHook();
          return mountDeferredValueImpl(hook, value, initialValue);
        },
        useTransition: function() {
          var stateHook = mountStateImpl(false);
          stateHook = startTransition.bind(
            null,
            currentlyRenderingFiber,
            stateHook.queue,
            true,
            false
          );
          mountWorkInProgressHook().memoizedState = stateHook;
          return [false, stateHook];
        },
        useSyncExternalStore: function(subscribe, getSnapshot, getServerSnapshot) {
          var fiber = currentlyRenderingFiber, hook = mountWorkInProgressHook();
          if (isHydrating) {
            if (void 0 === getServerSnapshot)
              throw Error(formatProdErrorMessage(407));
            getServerSnapshot = getServerSnapshot();
          } else {
            getServerSnapshot = getSnapshot();
            if (null === workInProgressRoot)
              throw Error(formatProdErrorMessage(349));
            0 !== (workInProgressRootRenderLanes & 127) || pushStoreConsistencyCheck(fiber, getSnapshot, getServerSnapshot);
          }
          hook.memoizedState = getServerSnapshot;
          var inst = { value: getServerSnapshot, getSnapshot };
          hook.queue = inst;
          mountEffect(subscribeToStore.bind(null, fiber, inst, subscribe), [
            subscribe
          ]);
          fiber.flags |= 2048;
          pushSimpleEffect(
            9,
            { destroy: void 0 },
            updateStoreInstance.bind(
              null,
              fiber,
              inst,
              getServerSnapshot,
              getSnapshot
            ),
            null
          );
          return getServerSnapshot;
        },
        useId: function() {
          var hook = mountWorkInProgressHook(), identifierPrefix = workInProgressRoot.identifierPrefix;
          if (isHydrating) {
            var JSCompiler_inline_result = treeContextOverflow;
            var idWithLeadingBit = treeContextId;
            JSCompiler_inline_result = (idWithLeadingBit & ~(1 << 32 - clz32(idWithLeadingBit) - 1)).toString(32) + JSCompiler_inline_result;
            identifierPrefix = "_" + identifierPrefix + "R_" + JSCompiler_inline_result;
            JSCompiler_inline_result = localIdCounter++;
            0 < JSCompiler_inline_result && (identifierPrefix += "H" + JSCompiler_inline_result.toString(32));
            identifierPrefix += "_";
          } else
            JSCompiler_inline_result = globalClientIdCounter++, identifierPrefix = "_" + identifierPrefix + "r_" + JSCompiler_inline_result.toString(32) + "_";
          return hook.memoizedState = identifierPrefix;
        },
        useHostTransitionStatus,
        useFormState: mountActionState,
        useActionState: mountActionState,
        useOptimistic: function(passthrough) {
          var hook = mountWorkInProgressHook();
          hook.memoizedState = hook.baseState = passthrough;
          var queue = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          hook.queue = queue;
          hook = dispatchOptimisticSetState.bind(
            null,
            currentlyRenderingFiber,
            true,
            queue
          );
          queue.dispatch = hook;
          return [passthrough, hook];
        },
        useMemoCache,
        useCacheRefresh: function() {
          return mountWorkInProgressHook().memoizedState = refreshCache.bind(
            null,
            currentlyRenderingFiber
          );
        },
        useEffectEvent: function(callback) {
          var hook = mountWorkInProgressHook(), ref = { impl: callback };
          hook.memoizedState = ref;
          return function() {
            if (0 !== (executionContext & 2))
              throw Error(formatProdErrorMessage(440));
            return ref.impl.apply(void 0, arguments);
          };
        }
      };
      var HooksDispatcherOnUpdate = {
        readContext,
        use,
        useCallback: updateCallback,
        useContext: readContext,
        useEffect: updateEffect,
        useImperativeHandle: updateImperativeHandle,
        useInsertionEffect: updateInsertionEffect,
        useLayoutEffect: updateLayoutEffect,
        useMemo: updateMemo,
        useReducer: updateReducer,
        useRef: updateRef,
        useState: function() {
          return updateReducer(basicStateReducer);
        },
        useDebugValue: mountDebugValue,
        useDeferredValue: function(value, initialValue) {
          var hook = updateWorkInProgressHook();
          return updateDeferredValueImpl(
            hook,
            currentHook.memoizedState,
            value,
            initialValue
          );
        },
        useTransition: function() {
          var booleanOrThenable = updateReducer(basicStateReducer)[0], start = updateWorkInProgressHook().memoizedState;
          return [
            "boolean" === typeof booleanOrThenable ? booleanOrThenable : useThenable(booleanOrThenable),
            start
          ];
        },
        useSyncExternalStore: updateSyncExternalStore,
        useId: updateId,
        useHostTransitionStatus,
        useFormState: updateActionState,
        useActionState: updateActionState,
        useOptimistic: function(passthrough, reducer) {
          var hook = updateWorkInProgressHook();
          return updateOptimisticImpl(hook, currentHook, passthrough, reducer);
        },
        useMemoCache,
        useCacheRefresh: updateRefresh,
        useEffectEvent: updateEvent
      };
      var HooksDispatcherOnRerender = {
        readContext,
        use,
        useCallback: updateCallback,
        useContext: readContext,
        useEffect: updateEffect,
        useImperativeHandle: updateImperativeHandle,
        useInsertionEffect: updateInsertionEffect,
        useLayoutEffect: updateLayoutEffect,
        useMemo: updateMemo,
        useReducer: rerenderReducer,
        useRef: updateRef,
        useState: function() {
          return rerenderReducer(basicStateReducer);
        },
        useDebugValue: mountDebugValue,
        useDeferredValue: function(value, initialValue) {
          var hook = updateWorkInProgressHook();
          return null === currentHook ? mountDeferredValueImpl(hook, value, initialValue) : updateDeferredValueImpl(
            hook,
            currentHook.memoizedState,
            value,
            initialValue
          );
        },
        useTransition: function() {
          var booleanOrThenable = rerenderReducer(basicStateReducer)[0], start = updateWorkInProgressHook().memoizedState;
          return [
            "boolean" === typeof booleanOrThenable ? booleanOrThenable : useThenable(booleanOrThenable),
            start
          ];
        },
        useSyncExternalStore: updateSyncExternalStore,
        useId: updateId,
        useHostTransitionStatus,
        useFormState: rerenderActionState,
        useActionState: rerenderActionState,
        useOptimistic: function(passthrough, reducer) {
          var hook = updateWorkInProgressHook();
          if (null !== currentHook)
            return updateOptimisticImpl(hook, currentHook, passthrough, reducer);
          hook.baseState = passthrough;
          return [passthrough, hook.queue.dispatch];
        },
        useMemoCache,
        useCacheRefresh: updateRefresh,
        useEffectEvent: updateEvent
      };
      function applyDerivedStateFromProps(workInProgress2, ctor, getDerivedStateFromProps, nextProps) {
        ctor = workInProgress2.memoizedState;
        getDerivedStateFromProps = getDerivedStateFromProps(nextProps, ctor);
        getDerivedStateFromProps = null === getDerivedStateFromProps || void 0 === getDerivedStateFromProps ? ctor : assign({}, ctor, getDerivedStateFromProps);
        workInProgress2.memoizedState = getDerivedStateFromProps;
        0 === workInProgress2.lanes && (workInProgress2.updateQueue.baseState = getDerivedStateFromProps);
      }
      var classComponentUpdater = {
        enqueueSetState: function(inst, payload, callback) {
          inst = inst._reactInternals;
          var lane = requestUpdateLane(), update = createUpdate(lane);
          update.payload = payload;
          void 0 !== callback && null !== callback && (update.callback = callback);
          payload = enqueueUpdate(inst, update, lane);
          null !== payload && (scheduleUpdateOnFiber(payload, inst, lane), entangleTransitions(payload, inst, lane));
        },
        enqueueReplaceState: function(inst, payload, callback) {
          inst = inst._reactInternals;
          var lane = requestUpdateLane(), update = createUpdate(lane);
          update.tag = 1;
          update.payload = payload;
          void 0 !== callback && null !== callback && (update.callback = callback);
          payload = enqueueUpdate(inst, update, lane);
          null !== payload && (scheduleUpdateOnFiber(payload, inst, lane), entangleTransitions(payload, inst, lane));
        },
        enqueueForceUpdate: function(inst, callback) {
          inst = inst._reactInternals;
          var lane = requestUpdateLane(), update = createUpdate(lane);
          update.tag = 2;
          void 0 !== callback && null !== callback && (update.callback = callback);
          callback = enqueueUpdate(inst, update, lane);
          null !== callback && (scheduleUpdateOnFiber(callback, inst, lane), entangleTransitions(callback, inst, lane));
        }
      };
      function checkShouldComponentUpdate(workInProgress2, ctor, oldProps, newProps, oldState, newState, nextContext) {
        workInProgress2 = workInProgress2.stateNode;
        return "function" === typeof workInProgress2.shouldComponentUpdate ? workInProgress2.shouldComponentUpdate(newProps, newState, nextContext) : ctor.prototype && ctor.prototype.isPureReactComponent ? !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState) : true;
      }
      function callComponentWillReceiveProps(workInProgress2, instance, newProps, nextContext) {
        workInProgress2 = instance.state;
        "function" === typeof instance.componentWillReceiveProps && instance.componentWillReceiveProps(newProps, nextContext);
        "function" === typeof instance.UNSAFE_componentWillReceiveProps && instance.UNSAFE_componentWillReceiveProps(newProps, nextContext);
        instance.state !== workInProgress2 && classComponentUpdater.enqueueReplaceState(instance, instance.state, null);
      }
      function resolveClassComponentProps(Component, baseProps) {
        var newProps = baseProps;
        if ("ref" in baseProps) {
          newProps = {};
          for (var propName in baseProps)
            "ref" !== propName && (newProps[propName] = baseProps[propName]);
        }
        if (Component = Component.defaultProps) {
          newProps === baseProps && (newProps = assign({}, newProps));
          for (var propName$77 in Component)
            void 0 === newProps[propName$77] && (newProps[propName$77] = Component[propName$77]);
        }
        return newProps;
      }
      function defaultOnUncaughtError(error) {
        reportGlobalError(error);
      }
      function defaultOnCaughtError(error) {
        console.error(error);
      }
      function defaultOnRecoverableError(error) {
        reportGlobalError(error);
      }
      function logUncaughtError(root2, errorInfo) {
        try {
          var onUncaughtError = root2.onUncaughtError;
          onUncaughtError(errorInfo.value, { componentStack: errorInfo.stack });
        } catch (e$78) {
          setTimeout(function() {
            throw e$78;
          });
        }
      }
      function logCaughtError(root2, boundary, errorInfo) {
        try {
          var onCaughtError = root2.onCaughtError;
          onCaughtError(errorInfo.value, {
            componentStack: errorInfo.stack,
            errorBoundary: 1 === boundary.tag ? boundary.stateNode : null
          });
        } catch (e$79) {
          setTimeout(function() {
            throw e$79;
          });
        }
      }
      function createRootErrorUpdate(root2, errorInfo, lane) {
        lane = createUpdate(lane);
        lane.tag = 3;
        lane.payload = { element: null };
        lane.callback = function() {
          logUncaughtError(root2, errorInfo);
        };
        return lane;
      }
      function createClassErrorUpdate(lane) {
        lane = createUpdate(lane);
        lane.tag = 3;
        return lane;
      }
      function initializeClassErrorUpdate(update, root2, fiber, errorInfo) {
        var getDerivedStateFromError = fiber.type.getDerivedStateFromError;
        if ("function" === typeof getDerivedStateFromError) {
          var error = errorInfo.value;
          update.payload = function() {
            return getDerivedStateFromError(error);
          };
          update.callback = function() {
            logCaughtError(root2, fiber, errorInfo);
          };
        }
        var inst = fiber.stateNode;
        null !== inst && "function" === typeof inst.componentDidCatch && (update.callback = function() {
          logCaughtError(root2, fiber, errorInfo);
          "function" !== typeof getDerivedStateFromError && (null === legacyErrorBoundariesThatAlreadyFailed ? legacyErrorBoundariesThatAlreadyFailed = /* @__PURE__ */ new Set([this]) : legacyErrorBoundariesThatAlreadyFailed.add(this));
          var stack = errorInfo.stack;
          this.componentDidCatch(errorInfo.value, {
            componentStack: null !== stack ? stack : ""
          });
        });
      }
      function throwException(root2, returnFiber, sourceFiber, value, rootRenderLanes) {
        sourceFiber.flags |= 32768;
        if (null !== value && "object" === typeof value && "function" === typeof value.then) {
          returnFiber = sourceFiber.alternate;
          null !== returnFiber && propagateParentContextChanges(
            returnFiber,
            sourceFiber,
            rootRenderLanes,
            true
          );
          sourceFiber = suspenseHandlerStackCursor.current;
          if (null !== sourceFiber) {
            switch (sourceFiber.tag) {
              case 31:
              case 13:
              case 19:
                return null === shellBoundary ? renderDidSuspendDelayIfPossible() : null === sourceFiber.alternate && 0 === workInProgressRootExitStatus && (workInProgressRootExitStatus = 3), sourceFiber.flags &= -257, sourceFiber.flags |= 65536, sourceFiber.lanes = rootRenderLanes, value === noopSuspenseyCommitThenable ? sourceFiber.flags |= 16384 : (returnFiber = sourceFiber.updateQueue, null === returnFiber ? sourceFiber.updateQueue = /* @__PURE__ */ new Set([value]) : returnFiber.add(value), attachPingListener(root2, value, rootRenderLanes)), false;
              case 22:
                return sourceFiber.flags |= 65536, value === noopSuspenseyCommitThenable ? sourceFiber.flags |= 16384 : (returnFiber = sourceFiber.updateQueue, null === returnFiber ? (returnFiber = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([value])
                }, sourceFiber.updateQueue = returnFiber) : (sourceFiber = returnFiber.retryQueue, null === sourceFiber ? returnFiber.retryQueue = /* @__PURE__ */ new Set([value]) : sourceFiber.add(value)), attachPingListener(root2, value, rootRenderLanes)), false;
            }
            throw Error(formatProdErrorMessage(435, sourceFiber.tag));
          }
          attachPingListener(root2, value, rootRenderLanes);
          renderDidSuspendDelayIfPossible();
          return false;
        }
        if (isHydrating)
          return returnFiber = suspenseHandlerStackCursor.current, null !== returnFiber ? (0 === (returnFiber.flags & 65536) && (returnFiber.flags |= 256), returnFiber.flags |= 65536, returnFiber.lanes = rootRenderLanes, value !== HydrationMismatchException && (root2 = Error(formatProdErrorMessage(422), { cause: value }), queueHydrationError(createCapturedValueAtFiber(root2, sourceFiber)))) : (value !== HydrationMismatchException && (returnFiber = Error(formatProdErrorMessage(423), {
            cause: value
          }), queueHydrationError(
            createCapturedValueAtFiber(returnFiber, sourceFiber)
          )), root2 = root2.current.alternate, root2.flags |= 65536, rootRenderLanes &= -rootRenderLanes, root2.lanes |= rootRenderLanes, value = createCapturedValueAtFiber(value, sourceFiber), rootRenderLanes = createRootErrorUpdate(
            root2.stateNode,
            value,
            rootRenderLanes
          ), enqueueCapturedUpdate(root2, rootRenderLanes), 4 !== workInProgressRootExitStatus && (workInProgressRootExitStatus = 2)), false;
        var wrapperError = Error(formatProdErrorMessage(520), { cause: value });
        wrapperError = createCapturedValueAtFiber(wrapperError, sourceFiber);
        null === workInProgressRootConcurrentErrors ? workInProgressRootConcurrentErrors = [wrapperError] : workInProgressRootConcurrentErrors.push(wrapperError);
        4 !== workInProgressRootExitStatus && (workInProgressRootExitStatus = 2);
        if (null === returnFiber) return true;
        value = createCapturedValueAtFiber(value, sourceFiber);
        sourceFiber = returnFiber;
        do {
          switch (sourceFiber.tag) {
            case 3:
              return sourceFiber.flags |= 65536, root2 = rootRenderLanes & -rootRenderLanes, sourceFiber.lanes |= root2, root2 = createRootErrorUpdate(sourceFiber.stateNode, value, root2), enqueueCapturedUpdate(sourceFiber, root2), false;
            case 1:
              returnFiber = sourceFiber.type;
              wrapperError = sourceFiber.stateNode;
              if (0 === (sourceFiber.flags & 128) && ("function" === typeof returnFiber.getDerivedStateFromError || null !== wrapperError && "function" === typeof wrapperError.componentDidCatch && (null === legacyErrorBoundariesThatAlreadyFailed || !legacyErrorBoundariesThatAlreadyFailed.has(wrapperError))))
                return sourceFiber.flags |= 65536, rootRenderLanes &= -rootRenderLanes, sourceFiber.lanes |= rootRenderLanes, rootRenderLanes = createClassErrorUpdate(rootRenderLanes), initializeClassErrorUpdate(
                  rootRenderLanes,
                  root2,
                  sourceFiber,
                  value
                ), enqueueCapturedUpdate(sourceFiber, rootRenderLanes), false;
              break;
            case 22:
              if (null !== sourceFiber.memoizedState)
                return sourceFiber.flags |= 65536, false;
          }
          sourceFiber = sourceFiber.return;
        } while (null !== sourceFiber);
        return false;
      }
      var SelectiveHydrationException = Error(formatProdErrorMessage(461));
      var didReceiveUpdate = false;
      function reconcileChildren(current, workInProgress2, nextChildren, renderLanes2) {
        workInProgress2.child = null === current ? mountChildFibers(workInProgress2, null, nextChildren, renderLanes2) : reconcileChildFibers(
          workInProgress2,
          current.child,
          nextChildren,
          renderLanes2
        );
      }
      function updateForwardRef(current, workInProgress2, Component, nextProps, renderLanes2) {
        Component = Component.render;
        var ref = workInProgress2.ref;
        if ("ref" in nextProps) {
          var propsWithoutRef = {};
          for (var key in nextProps)
            "ref" !== key && (propsWithoutRef[key] = nextProps[key]);
        } else propsWithoutRef = nextProps;
        prepareToReadContext(workInProgress2);
        nextProps = renderWithHooks(
          current,
          workInProgress2,
          Component,
          propsWithoutRef,
          ref,
          renderLanes2
        );
        key = checkDidRenderIdHook();
        if (null !== current && !didReceiveUpdate)
          return bailoutHooks(current, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        isHydrating && key && pushMaterializedTreeId(workInProgress2);
        workInProgress2.flags |= 1;
        reconcileChildren(current, workInProgress2, nextProps, renderLanes2);
        return workInProgress2.child;
      }
      function updateMemoComponent(current, workInProgress2, Component, nextProps, renderLanes2) {
        if (null === current) {
          var type = Component.type;
          if ("function" === typeof type && !shouldConstruct(type) && void 0 === type.defaultProps && null === Component.compare)
            return workInProgress2.tag = 15, workInProgress2.type = type, updateSimpleMemoComponent(
              current,
              workInProgress2,
              type,
              nextProps,
              renderLanes2
            );
          current = createFiberFromTypeAndProps(
            Component.type,
            null,
            nextProps,
            workInProgress2,
            workInProgress2.mode,
            renderLanes2
          );
          current.ref = workInProgress2.ref;
          current.return = workInProgress2;
          return workInProgress2.child = current;
        }
        type = current.child;
        if (!checkScheduledUpdateOrContext(current, renderLanes2)) {
          var prevProps = type.memoizedProps;
          Component = Component.compare;
          Component = null !== Component ? Component : shallowEqual;
          if (Component(prevProps, nextProps) && current.ref === workInProgress2.ref)
            return bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        }
        workInProgress2.flags |= 1;
        current = createWorkInProgress(type, nextProps);
        current.ref = workInProgress2.ref;
        current.return = workInProgress2;
        return workInProgress2.child = current;
      }
      function updateSimpleMemoComponent(current, workInProgress2, Component, nextProps, renderLanes2) {
        if (null !== current) {
          var prevProps = current.memoizedProps;
          if (shallowEqual(prevProps, nextProps) && current.ref === workInProgress2.ref)
            if (didReceiveUpdate = false, workInProgress2.pendingProps = nextProps = prevProps, checkScheduledUpdateOrContext(current, renderLanes2))
              0 !== (current.flags & 131072) && (didReceiveUpdate = true);
            else
              return workInProgress2.lanes = current.lanes, bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        }
        return updateFunctionComponent(
          current,
          workInProgress2,
          Component,
          nextProps,
          renderLanes2
        );
      }
      function updateOffscreenComponent(current, workInProgress2, renderLanes2, nextProps) {
        var nextChildren = nextProps.children, prevState = null !== current ? current.memoizedState : null;
        null === current && null === workInProgress2.stateNode && (workInProgress2.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        });
        if ("hidden" === nextProps.mode) {
          if (0 !== (workInProgress2.flags & 128)) {
            prevState = null !== prevState ? prevState.baseLanes | renderLanes2 : renderLanes2;
            if (null !== current) {
              nextProps = workInProgress2.child = current.child;
              for (nextChildren = 0; null !== nextProps; )
                nextChildren = nextChildren | nextProps.lanes | nextProps.childLanes, nextProps = nextProps.sibling;
              nextProps = nextChildren & ~prevState;
            } else nextProps = 0, workInProgress2.child = null;
            return deferHiddenOffscreenComponent(
              current,
              workInProgress2,
              prevState,
              renderLanes2,
              nextProps
            );
          }
          if (0 !== (renderLanes2 & 536870912))
            workInProgress2.memoizedState = { baseLanes: 0, cachePool: null }, null !== current && pushTransition(
              workInProgress2,
              null !== prevState ? prevState.cachePool : null
            ), null !== prevState ? pushHiddenContext(workInProgress2, prevState) : reuseHiddenContextOnStack(), pushOffscreenSuspenseHandler(workInProgress2);
          else
            return nextProps = workInProgress2.lanes = 536870912, deferHiddenOffscreenComponent(
              current,
              workInProgress2,
              null !== prevState ? prevState.baseLanes | renderLanes2 : renderLanes2,
              renderLanes2,
              nextProps
            );
        } else
          null !== prevState ? (pushTransition(workInProgress2, prevState.cachePool), pushHiddenContext(workInProgress2, prevState), reuseSuspenseHandlerOnStack(), workInProgress2.memoizedState = null) : (null !== current && pushTransition(workInProgress2, null), reuseHiddenContextOnStack(), reuseSuspenseHandlerOnStack());
        reconcileChildren(current, workInProgress2, nextChildren, renderLanes2);
        return workInProgress2.child;
      }
      function bailoutOffscreenComponent(current, workInProgress2) {
        null !== current && 22 === current.tag || null !== workInProgress2.stateNode || (workInProgress2.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        });
        return workInProgress2.sibling;
      }
      function deferHiddenOffscreenComponent(current, workInProgress2, nextBaseLanes, renderLanes2, remainingChildLanes) {
        var JSCompiler_inline_result = peekCacheFromPool();
        JSCompiler_inline_result = null === JSCompiler_inline_result ? null : { parent: CacheContext._currentValue, pool: JSCompiler_inline_result };
        workInProgress2.memoizedState = {
          baseLanes: nextBaseLanes,
          cachePool: JSCompiler_inline_result
        };
        null !== current && pushTransition(workInProgress2, null);
        reuseHiddenContextOnStack();
        pushOffscreenSuspenseHandler(workInProgress2);
        null !== current && propagateParentContextChanges(current, workInProgress2, renderLanes2, true);
        workInProgress2.childLanes = remainingChildLanes;
        return null;
      }
      function mountActivityChildren(workInProgress2, nextProps) {
        nextProps = mountWorkInProgressOffscreenFiber(
          { mode: nextProps.mode, children: nextProps.children },
          workInProgress2.mode
        );
        nextProps.ref = workInProgress2.ref;
        workInProgress2.child = nextProps;
        nextProps.return = workInProgress2;
        return nextProps;
      }
      function retryActivityComponentWithoutHydrating(current, workInProgress2, renderLanes2) {
        reconcileChildFibers(workInProgress2, current.child, null, renderLanes2);
        current = mountActivityChildren(workInProgress2, workInProgress2.pendingProps);
        current.flags |= 2;
        popSuspenseHandler(workInProgress2);
        workInProgress2.memoizedState = null;
        return current;
      }
      function updateActivityComponent(current, workInProgress2, renderLanes2) {
        var nextProps = workInProgress2.pendingProps, didSuspend = 0 !== (workInProgress2.flags & 128);
        workInProgress2.flags &= -129;
        if (null === current) {
          if (isHydrating) {
            if ("hidden" === nextProps.mode)
              return current = mountActivityChildren(workInProgress2, nextProps), workInProgress2.lanes = 536870912, current.memoizedState = { baseLanes: 0, cachePool: null }, bailoutOffscreenComponent(null, current);
            pushDehydratedActivitySuspenseHandler(workInProgress2);
            (current = nextHydratableInstance) ? (current = canHydrateHydrationBoundary(
              current,
              rootOrSingletonContext
            ), current = null !== current && "&" === current.data ? current : null, null !== current && (workInProgress2.memoizedState = {
              dehydrated: current,
              treeContext: null !== treeContextProvider ? { id: treeContextId, overflow: treeContextOverflow } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, renderLanes2 = createFiberFromDehydratedFragment(current), renderLanes2.return = workInProgress2, workInProgress2.child = renderLanes2, hydrationParentFiber = workInProgress2, nextHydratableInstance = null)) : current = null;
            if (null === current) throw throwOnHydrationMismatch(workInProgress2);
            workInProgress2.lanes = 536870912;
            return null;
          }
          return mountActivityChildren(workInProgress2, nextProps);
        }
        var prevState = current.memoizedState;
        if (null !== prevState) {
          var dehydrated = prevState.dehydrated;
          pushDehydratedActivitySuspenseHandler(workInProgress2);
          if (didSuspend)
            if (workInProgress2.flags & 256)
              workInProgress2.flags &= -257, workInProgress2 = retryActivityComponentWithoutHydrating(
                current,
                workInProgress2,
                renderLanes2
              );
            else if (null !== workInProgress2.memoizedState)
              workInProgress2.child = current.child, workInProgress2.flags |= 128, workInProgress2 = null;
            else throw Error(formatProdErrorMessage(558));
          else if (didReceiveUpdate || propagateParentContextChanges(current, workInProgress2, renderLanes2, false), didSuspend = 0 !== (renderLanes2 & current.childLanes), didReceiveUpdate || didSuspend) {
            if (null === currentTreeHiddenStackCursor.current) {
              nextProps = workInProgressRoot;
              if (null !== nextProps && (dehydrated = getBumpedLaneForHydration(nextProps, renderLanes2), 0 !== dehydrated && dehydrated !== prevState.retryLane))
                throw prevState.retryLane = dehydrated, enqueueConcurrentRenderForLane(current, dehydrated), scheduleUpdateOnFiber(nextProps, current, dehydrated), SelectiveHydrationException;
              renderDidSuspendDelayIfPossible();
            }
            workInProgress2 = retryActivityComponentWithoutHydrating(
              current,
              workInProgress2,
              renderLanes2
            );
          } else
            current = prevState.treeContext, nextHydratableInstance = getNextHydratable(dehydrated.nextSibling), hydrationParentFiber = workInProgress2, isHydrating = true, hydrationErrors = null, rootOrSingletonContext = false, null !== current && restoreSuspendedTreeContext(workInProgress2, current), workInProgress2 = mountActivityChildren(workInProgress2, nextProps), workInProgress2.flags |= 134221824;
          return workInProgress2;
        }
        current = createWorkInProgress(current.child, {
          mode: nextProps.mode,
          children: nextProps.children
        });
        current.ref = workInProgress2.ref;
        workInProgress2.child = current;
        current.return = workInProgress2;
        return current;
      }
      function markRef(current, workInProgress2) {
        var ref = workInProgress2.ref;
        if (null === ref)
          null !== current && null !== current.ref && (workInProgress2.flags |= 4194816);
        else {
          if ("function" !== typeof ref && "object" !== typeof ref)
            throw Error(formatProdErrorMessage(284));
          if (null === current || current.ref !== ref)
            workInProgress2.flags |= 4194816;
        }
      }
      function updateFunctionComponent(current, workInProgress2, Component, nextProps, renderLanes2) {
        prepareToReadContext(workInProgress2);
        Component = renderWithHooks(
          current,
          workInProgress2,
          Component,
          nextProps,
          void 0,
          renderLanes2
        );
        nextProps = checkDidRenderIdHook();
        if (null !== current && !didReceiveUpdate)
          return bailoutHooks(current, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        isHydrating && nextProps && pushMaterializedTreeId(workInProgress2);
        workInProgress2.flags |= 1;
        reconcileChildren(current, workInProgress2, Component, renderLanes2);
        return workInProgress2.child;
      }
      function replayFunctionComponent(current, workInProgress2, nextProps, Component, secondArg, renderLanes2) {
        prepareToReadContext(workInProgress2);
        workInProgress2.updateQueue = null;
        nextProps = renderWithHooksAgain(
          workInProgress2,
          Component,
          nextProps,
          secondArg
        );
        finishRenderingHooks(current);
        Component = checkDidRenderIdHook();
        if (null !== current && !didReceiveUpdate)
          return bailoutHooks(current, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        isHydrating && Component && pushMaterializedTreeId(workInProgress2);
        workInProgress2.flags |= 1;
        reconcileChildren(current, workInProgress2, nextProps, renderLanes2);
        return workInProgress2.child;
      }
      function updateClassComponent(current, workInProgress2, Component, nextProps, renderLanes2) {
        prepareToReadContext(workInProgress2);
        if (null === workInProgress2.stateNode) {
          var context = emptyContextObject, contextType = Component.contextType;
          "object" === typeof contextType && null !== contextType && (context = readContext(contextType));
          context = new Component(nextProps, context);
          workInProgress2.memoizedState = null !== context.state && void 0 !== context.state ? context.state : null;
          context.updater = classComponentUpdater;
          workInProgress2.stateNode = context;
          context._reactInternals = workInProgress2;
          context = workInProgress2.stateNode;
          context.props = nextProps;
          context.state = workInProgress2.memoizedState;
          context.refs = {};
          initializeUpdateQueue(workInProgress2);
          contextType = Component.contextType;
          context.context = "object" === typeof contextType && null !== contextType ? readContext(contextType) : emptyContextObject;
          context.state = workInProgress2.memoizedState;
          contextType = Component.getDerivedStateFromProps;
          "function" === typeof contextType && (applyDerivedStateFromProps(
            workInProgress2,
            Component,
            contextType,
            nextProps
          ), context.state = workInProgress2.memoizedState);
          "function" === typeof Component.getDerivedStateFromProps || "function" === typeof context.getSnapshotBeforeUpdate || "function" !== typeof context.UNSAFE_componentWillMount && "function" !== typeof context.componentWillMount || (contextType = context.state, "function" === typeof context.componentWillMount && context.componentWillMount(), "function" === typeof context.UNSAFE_componentWillMount && context.UNSAFE_componentWillMount(), contextType !== context.state && classComponentUpdater.enqueueReplaceState(context, context.state, null), processUpdateQueue(workInProgress2, nextProps, context, renderLanes2), suspendIfUpdateReadFromEntangledAsyncAction(), context.state = workInProgress2.memoizedState);
          "function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308);
          nextProps = true;
        } else if (null === current) {
          context = workInProgress2.stateNode;
          var unresolvedOldProps = workInProgress2.memoizedProps, oldProps = resolveClassComponentProps(Component, unresolvedOldProps);
          context.props = oldProps;
          var oldContext = context.context, contextType$jscomp$0 = Component.contextType;
          contextType = emptyContextObject;
          "object" === typeof contextType$jscomp$0 && null !== contextType$jscomp$0 && (contextType = readContext(contextType$jscomp$0));
          var getDerivedStateFromProps = Component.getDerivedStateFromProps;
          contextType$jscomp$0 = "function" === typeof getDerivedStateFromProps || "function" === typeof context.getSnapshotBeforeUpdate;
          unresolvedOldProps = workInProgress2.pendingProps !== unresolvedOldProps;
          contextType$jscomp$0 || "function" !== typeof context.UNSAFE_componentWillReceiveProps && "function" !== typeof context.componentWillReceiveProps || (unresolvedOldProps || oldContext !== contextType) && callComponentWillReceiveProps(
            workInProgress2,
            context,
            nextProps,
            contextType
          );
          hasForceUpdate = false;
          var oldState = workInProgress2.memoizedState;
          context.state = oldState;
          processUpdateQueue(workInProgress2, nextProps, context, renderLanes2);
          suspendIfUpdateReadFromEntangledAsyncAction();
          oldContext = workInProgress2.memoizedState;
          unresolvedOldProps || oldState !== oldContext || hasForceUpdate ? ("function" === typeof getDerivedStateFromProps && (applyDerivedStateFromProps(
            workInProgress2,
            Component,
            getDerivedStateFromProps,
            nextProps
          ), oldContext = workInProgress2.memoizedState), (oldProps = hasForceUpdate || checkShouldComponentUpdate(
            workInProgress2,
            Component,
            oldProps,
            nextProps,
            oldState,
            oldContext,
            contextType
          )) ? (contextType$jscomp$0 || "function" !== typeof context.UNSAFE_componentWillMount && "function" !== typeof context.componentWillMount || ("function" === typeof context.componentWillMount && context.componentWillMount(), "function" === typeof context.UNSAFE_componentWillMount && context.UNSAFE_componentWillMount()), "function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308)) : ("function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308), workInProgress2.memoizedProps = nextProps, workInProgress2.memoizedState = oldContext), context.props = nextProps, context.state = oldContext, context.context = contextType, nextProps = oldProps) : ("function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308), nextProps = false);
        } else {
          context = workInProgress2.stateNode;
          cloneUpdateQueue(current, workInProgress2);
          contextType = workInProgress2.memoizedProps;
          contextType$jscomp$0 = resolveClassComponentProps(Component, contextType);
          context.props = contextType$jscomp$0;
          getDerivedStateFromProps = workInProgress2.pendingProps;
          oldState = context.context;
          oldContext = Component.contextType;
          oldProps = emptyContextObject;
          "object" === typeof oldContext && null !== oldContext && (oldProps = readContext(oldContext));
          unresolvedOldProps = Component.getDerivedStateFromProps;
          (oldContext = "function" === typeof unresolvedOldProps || "function" === typeof context.getSnapshotBeforeUpdate) || "function" !== typeof context.UNSAFE_componentWillReceiveProps && "function" !== typeof context.componentWillReceiveProps || (contextType !== getDerivedStateFromProps || oldState !== oldProps) && callComponentWillReceiveProps(
            workInProgress2,
            context,
            nextProps,
            oldProps
          );
          hasForceUpdate = false;
          oldState = workInProgress2.memoizedState;
          context.state = oldState;
          processUpdateQueue(workInProgress2, nextProps, context, renderLanes2);
          suspendIfUpdateReadFromEntangledAsyncAction();
          var newState = workInProgress2.memoizedState;
          contextType !== getDerivedStateFromProps || oldState !== newState || hasForceUpdate || null !== current && null !== current.dependencies && checkIfContextChanged(current.dependencies) ? ("function" === typeof unresolvedOldProps && (applyDerivedStateFromProps(
            workInProgress2,
            Component,
            unresolvedOldProps,
            nextProps
          ), newState = workInProgress2.memoizedState), (contextType$jscomp$0 = hasForceUpdate || checkShouldComponentUpdate(
            workInProgress2,
            Component,
            contextType$jscomp$0,
            nextProps,
            oldState,
            newState,
            oldProps
          ) || null !== current && null !== current.dependencies && checkIfContextChanged(current.dependencies)) ? (oldContext || "function" !== typeof context.UNSAFE_componentWillUpdate && "function" !== typeof context.componentWillUpdate || ("function" === typeof context.componentWillUpdate && context.componentWillUpdate(nextProps, newState, oldProps), "function" === typeof context.UNSAFE_componentWillUpdate && context.UNSAFE_componentWillUpdate(
            nextProps,
            newState,
            oldProps
          )), "function" === typeof context.componentDidUpdate && (workInProgress2.flags |= 4), "function" === typeof context.getSnapshotBeforeUpdate && (workInProgress2.flags |= 1024)) : ("function" !== typeof context.componentDidUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 4), "function" !== typeof context.getSnapshotBeforeUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 1024), workInProgress2.memoizedProps = nextProps, workInProgress2.memoizedState = newState), context.props = nextProps, context.state = newState, context.context = oldProps, nextProps = contextType$jscomp$0) : ("function" !== typeof context.componentDidUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 4), "function" !== typeof context.getSnapshotBeforeUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 1024), nextProps = false);
        }
        context = nextProps;
        markRef(current, workInProgress2);
        nextProps = 0 !== (workInProgress2.flags & 128);
        context || nextProps ? (context = workInProgress2.stateNode, Component = nextProps && "function" !== typeof Component.getDerivedStateFromError ? null : context.render(), workInProgress2.flags |= 1, null !== current && nextProps ? (workInProgress2.child = reconcileChildFibers(
          workInProgress2,
          current.child,
          null,
          renderLanes2
        ), workInProgress2.child = reconcileChildFibers(
          workInProgress2,
          null,
          Component,
          renderLanes2
        )) : reconcileChildren(current, workInProgress2, Component, renderLanes2), workInProgress2.memoizedState = context.state, current = workInProgress2.child) : current = bailoutOnAlreadyFinishedWork(
          current,
          workInProgress2,
          renderLanes2
        );
        return current;
      }
      function mountHostRootWithoutHydrating(current, workInProgress2, nextChildren, renderLanes2) {
        resetHydrationState();
        workInProgress2.flags |= 256;
        reconcileChildren(current, workInProgress2, nextChildren, renderLanes2);
        return workInProgress2.child;
      }
      var SUSPENDED_MARKER = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      };
      function mountSuspenseOffscreenState(renderLanes2) {
        return { baseLanes: renderLanes2, cachePool: getSuspendedCache() };
      }
      function getRemainingWorkInPrimaryTree(current, primaryTreeDidDefer, renderLanes2) {
        current = null !== current ? current.childLanes & ~renderLanes2 : 0;
        primaryTreeDidDefer && (current |= workInProgressDeferredLane);
        return current;
      }
      function updateSuspenseComponent(current, workInProgress2, renderLanes2) {
        var nextProps = workInProgress2.pendingProps, showFallback = false, didSuspend = 0 !== (workInProgress2.flags & 128), JSCompiler_temp;
        (JSCompiler_temp = didSuspend) || (JSCompiler_temp = null !== current && null === current.memoizedState ? false : 0 !== (suspenseStackCursor.current & 2));
        JSCompiler_temp && (showFallback = true, workInProgress2.flags &= -129);
        JSCompiler_temp = 0 !== (workInProgress2.flags & 32);
        workInProgress2.flags &= -33;
        if (null === current) {
          if (isHydrating) {
            showFallback ? pushPrimaryTreeSuspenseHandler(workInProgress2) : reuseSuspenseHandlerOnStack();
            (current = nextHydratableInstance) ? (current = canHydrateHydrationBoundary(
              current,
              rootOrSingletonContext
            ), current = null !== current && "&" !== current.data ? current : null, null !== current && (workInProgress2.memoizedState = {
              dehydrated: current,
              treeContext: null !== treeContextProvider ? { id: treeContextId, overflow: treeContextOverflow } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, renderLanes2 = createFiberFromDehydratedFragment(current), renderLanes2.return = workInProgress2, workInProgress2.child = renderLanes2, hydrationParentFiber = workInProgress2, nextHydratableInstance = null)) : current = null;
            if (null === current) throw throwOnHydrationMismatch(workInProgress2);
            isSuspenseInstanceFallback(current) ? workInProgress2.lanes = 32 : workInProgress2.lanes = 536870912;
            return null;
          }
          didSuspend = nextProps.children;
          nextProps = nextProps.fallback;
          if (showFallback)
            return reuseSuspenseHandlerOnStack(), showFallback = workInProgress2.mode, didSuspend = mountWorkInProgressOffscreenFiber(
              { mode: "hidden", children: didSuspend },
              showFallback
            ), nextProps = createFiberFromFragment(
              nextProps,
              showFallback,
              renderLanes2,
              null
            ), didSuspend.return = workInProgress2, nextProps.return = workInProgress2, didSuspend.sibling = nextProps, workInProgress2.child = didSuspend, nextProps = workInProgress2.child, nextProps.memoizedState = mountSuspenseOffscreenState(renderLanes2), nextProps.childLanes = getRemainingWorkInPrimaryTree(
              current,
              JSCompiler_temp,
              renderLanes2
            ), workInProgress2.memoizedState = SUSPENDED_MARKER, bailoutOffscreenComponent(null, nextProps);
          pushPrimaryTreeSuspenseHandler(workInProgress2);
          return mountSuspensePrimaryChildren(workInProgress2, didSuspend);
        }
        var prevState = current.memoizedState;
        if (null !== prevState) {
          var dehydrated$96 = prevState.dehydrated;
          if (null !== dehydrated$96)
            return updateDehydratedSuspenseComponent(
              current,
              workInProgress2,
              didSuspend,
              JSCompiler_temp,
              nextProps,
              dehydrated$96,
              prevState,
              renderLanes2
            );
        }
        if (showFallback)
          return reuseSuspenseHandlerOnStack(), showFallback = nextProps.fallback, didSuspend = workInProgress2.mode, prevState = current.child, dehydrated$96 = prevState.sibling, nextProps = createWorkInProgress(prevState, {
            mode: "hidden",
            children: nextProps.children
          }), nextProps.subtreeFlags = prevState.subtreeFlags & 1206910976, null !== dehydrated$96 ? showFallback = createWorkInProgress(dehydrated$96, showFallback) : (showFallback = createFiberFromFragment(
            showFallback,
            didSuspend,
            renderLanes2,
            null
          ), showFallback.flags |= 2), showFallback.return = workInProgress2, nextProps.return = workInProgress2, nextProps.sibling = showFallback, workInProgress2.child = nextProps, bailoutOffscreenComponent(null, nextProps), nextProps = workInProgress2.child, showFallback = current.child.memoizedState, null === showFallback ? showFallback = mountSuspenseOffscreenState(renderLanes2) : (didSuspend = showFallback.cachePool, null !== didSuspend ? (prevState = CacheContext._currentValue, didSuspend = didSuspend.parent !== prevState ? { parent: prevState, pool: prevState } : didSuspend) : didSuspend = getSuspendedCache(), showFallback = {
            baseLanes: showFallback.baseLanes | renderLanes2,
            cachePool: didSuspend
          }), nextProps.memoizedState = showFallback, nextProps.childLanes = getRemainingWorkInPrimaryTree(
            current,
            JSCompiler_temp,
            renderLanes2
          ), workInProgress2.memoizedState = SUSPENDED_MARKER, bailoutOffscreenComponent(current.child, nextProps);
        pushPrimaryTreeSuspenseHandler(workInProgress2);
        renderLanes2 = current.child;
        current = renderLanes2.sibling;
        renderLanes2 = createWorkInProgress(renderLanes2, {
          mode: "visible",
          children: nextProps.children
        });
        renderLanes2.return = workInProgress2;
        renderLanes2.sibling = null;
        null !== current && (JSCompiler_temp = workInProgress2.deletions, null === JSCompiler_temp ? (workInProgress2.deletions = [current], workInProgress2.flags |= 16) : JSCompiler_temp.push(current));
        workInProgress2.child = renderLanes2;
        workInProgress2.memoizedState = null;
        return renderLanes2;
      }
      function mountSuspensePrimaryChildren(workInProgress2, primaryChildren) {
        primaryChildren = mountWorkInProgressOffscreenFiber(
          { mode: "visible", children: primaryChildren },
          workInProgress2.mode
        );
        primaryChildren.return = workInProgress2;
        return workInProgress2.child = primaryChildren;
      }
      function mountWorkInProgressOffscreenFiber(offscreenProps, mode) {
        offscreenProps = createFiberImplClass(22, offscreenProps, null, mode);
        offscreenProps.lanes = 0;
        return offscreenProps;
      }
      function retrySuspenseComponentWithoutHydrating(current, workInProgress2, renderLanes2) {
        reconcileChildFibers(workInProgress2, current.child, null, renderLanes2);
        current = mountSuspensePrimaryChildren(
          workInProgress2,
          workInProgress2.pendingProps.children
        );
        current.flags |= 2;
        workInProgress2.memoizedState = null;
        return current;
      }
      function updateDehydratedSuspenseComponent(current, workInProgress2, didSuspend, didPrimaryChildrenDefer, nextProps, suspenseInstance, suspenseState, renderLanes2) {
        if (didSuspend) {
          if (workInProgress2.flags & 256)
            return pushPrimaryTreeSuspenseHandler(workInProgress2), workInProgress2.flags &= -257, retrySuspenseComponentWithoutHydrating(
              current,
              workInProgress2,
              renderLanes2
            );
          if (null !== workInProgress2.memoizedState)
            return reuseSuspenseHandlerOnStack(), workInProgress2.child = current.child, workInProgress2.flags |= 128, null;
          reuseSuspenseHandlerOnStack();
          suspenseInstance = nextProps.fallback;
          suspenseState = workInProgress2.mode;
          nextProps = mountWorkInProgressOffscreenFiber(
            { mode: "visible", children: nextProps.children },
            suspenseState
          );
          suspenseInstance = createFiberFromFragment(
            suspenseInstance,
            suspenseState,
            renderLanes2,
            null
          );
          suspenseInstance.flags |= 2;
          nextProps.return = workInProgress2;
          suspenseInstance.return = workInProgress2;
          nextProps.sibling = suspenseInstance;
          workInProgress2.child = nextProps;
          reconcileChildFibers(workInProgress2, current.child, null, renderLanes2);
          nextProps = workInProgress2.child;
          nextProps.memoizedState = mountSuspenseOffscreenState(renderLanes2);
          nextProps.childLanes = getRemainingWorkInPrimaryTree(
            current,
            didPrimaryChildrenDefer,
            renderLanes2
          );
          workInProgress2.memoizedState = SUSPENDED_MARKER;
          return bailoutOffscreenComponent(null, nextProps);
        }
        pushPrimaryTreeSuspenseHandler(workInProgress2);
        if (isSuspenseInstanceFallback(suspenseInstance)) {
          didPrimaryChildrenDefer = suspenseInstance.nextSibling && suspenseInstance.nextSibling.dataset;
          if (didPrimaryChildrenDefer) var digest = didPrimaryChildrenDefer.dgst;
          didPrimaryChildrenDefer = digest;
          "" !== didPrimaryChildrenDefer && (nextProps = Error(formatProdErrorMessage(419)), nextProps.stack = "", nextProps.digest = didPrimaryChildrenDefer, queueHydrationError({ value: nextProps, source: null, stack: null }));
          return retrySuspenseComponentWithoutHydrating(
            current,
            workInProgress2,
            renderLanes2
          );
        }
        didReceiveUpdate || propagateParentContextChanges(current, workInProgress2, renderLanes2, false);
        didPrimaryChildrenDefer = 0 !== (renderLanes2 & current.childLanes);
        if (didReceiveUpdate || didPrimaryChildrenDefer) {
          if (null !== currentTreeHiddenStackCursor.current)
            return retrySuspenseComponentWithoutHydrating(
              current,
              workInProgress2,
              renderLanes2
            );
          didPrimaryChildrenDefer = workInProgressRoot;
          if (null !== didPrimaryChildrenDefer && (nextProps = getBumpedLaneForHydration(
            didPrimaryChildrenDefer,
            renderLanes2
          ), 0 !== nextProps && nextProps !== suspenseState.retryLane))
            throw suspenseState.retryLane = nextProps, enqueueConcurrentRenderForLane(current, nextProps), scheduleUpdateOnFiber(didPrimaryChildrenDefer, current, nextProps), SelectiveHydrationException;
          isSuspenseInstancePending(suspenseInstance) || renderDidSuspendDelayIfPossible();
          return retrySuspenseComponentWithoutHydrating(
            current,
            workInProgress2,
            renderLanes2
          );
        }
        if (isSuspenseInstancePending(suspenseInstance))
          return workInProgress2.flags |= 192, workInProgress2.child = current.child, null;
        current = suspenseState.treeContext;
        nextHydratableInstance = getNextHydratable(suspenseInstance.nextSibling);
        hydrationParentFiber = workInProgress2;
        isHydrating = true;
        hydrationErrors = null;
        rootOrSingletonContext = false;
        null !== current && restoreSuspendedTreeContext(workInProgress2, current);
        workInProgress2 = mountSuspensePrimaryChildren(
          workInProgress2,
          nextProps.children
        );
        workInProgress2.flags |= 134221824;
        return workInProgress2;
      }
      function scheduleSuspenseWorkOnFiber(fiber, renderLanes2, propagationRoot) {
        fiber.lanes |= renderLanes2;
        var alternate = fiber.alternate;
        null !== alternate && (alternate.lanes |= renderLanes2);
        scheduleContextWorkOnParentPath(fiber.return, renderLanes2, propagationRoot);
      }
      function findLastContentRow(firstChild) {
        for (var lastContentRow = null; null !== firstChild; ) {
          var currentRow = firstChild.alternate;
          null !== currentRow && null === findFirstSuspended(currentRow) && (lastContentRow = firstChild);
          firstChild = firstChild.sibling;
        }
        return lastContentRow;
      }
      function initSuspenseListRenderState(workInProgress2, isBackwards, tail, lastContentRow, tailMode, treeForkCount2) {
        var renderState = workInProgress2.memoizedState;
        null === renderState ? workInProgress2.memoizedState = {
          isBackwards,
          rendering: null,
          renderingStartTime: 0,
          last: lastContentRow,
          tail,
          tailMode,
          treeForkCount: treeForkCount2
        } : (renderState.isBackwards = isBackwards, renderState.rendering = null, renderState.renderingStartTime = 0, renderState.last = lastContentRow, renderState.tail = tail, renderState.tailMode = tailMode, renderState.treeForkCount = treeForkCount2);
      }
      function reverseChildren(fiber) {
        var row = fiber.child;
        for (fiber.child = null; null !== row; ) {
          var nextRow = row.sibling;
          row.sibling = fiber.child;
          fiber.child = row;
          row = nextRow;
        }
      }
      function updateSuspenseListComponent(current, workInProgress2, renderLanes2) {
        var nextProps = workInProgress2.pendingProps, revealOrder = nextProps.revealOrder, tailMode = nextProps.tail;
        nextProps = nextProps.children;
        var suspenseContext = suspenseStackCursor.current;
        if (workInProgress2.flags & 128)
          return pushSuspenseListContext(workInProgress2, suspenseContext), null;
        var shouldForceFallback = 0 !== (suspenseContext & 2);
        shouldForceFallback ? (suspenseContext = suspenseContext & 1 | 2, workInProgress2.flags |= 128) : suspenseContext &= 1;
        pushSuspenseListContext(workInProgress2, suspenseContext);
        "backwards" === revealOrder && null !== current ? (reverseChildren(current), reconcileChildren(current, workInProgress2, nextProps, renderLanes2), reverseChildren(current)) : reconcileChildren(current, workInProgress2, nextProps, renderLanes2);
        nextProps = isHydrating ? treeForkCount : 0;
        if (!shouldForceFallback && null !== current && 0 !== (current.flags & 128))
          a: for (current = workInProgress2.child; null !== current; ) {
            if (13 === current.tag)
              null !== current.memoizedState && scheduleSuspenseWorkOnFiber(current, renderLanes2, workInProgress2);
            else if (19 === current.tag)
              scheduleSuspenseWorkOnFiber(current, renderLanes2, workInProgress2);
            else if (null !== current.child) {
              current.child.return = current;
              current = current.child;
              continue;
            }
            if (current === workInProgress2) break a;
            for (; null === current.sibling; ) {
              if (null === current.return || current.return === workInProgress2)
                break a;
              current = current.return;
            }
            current.sibling.return = current.return;
            current = current.sibling;
          }
        switch (revealOrder) {
          case "backwards":
            renderLanes2 = findLastContentRow(workInProgress2.child);
            null === renderLanes2 ? (revealOrder = workInProgress2.child, workInProgress2.child = null) : (revealOrder = renderLanes2.sibling, renderLanes2.sibling = null, reverseChildren(workInProgress2));
            initSuspenseListRenderState(
              workInProgress2,
              true,
              revealOrder,
              null,
              tailMode,
              nextProps
            );
            break;
          case "unstable_legacy-backwards":
            renderLanes2 = null;
            revealOrder = workInProgress2.child;
            for (workInProgress2.child = null; null !== revealOrder; ) {
              current = revealOrder.alternate;
              if (null !== current && null === findFirstSuspended(current)) {
                workInProgress2.child = revealOrder;
                break;
              }
              current = revealOrder.sibling;
              revealOrder.sibling = renderLanes2;
              renderLanes2 = revealOrder;
              revealOrder = current;
            }
            initSuspenseListRenderState(
              workInProgress2,
              true,
              renderLanes2,
              null,
              tailMode,
              nextProps
            );
            break;
          case "together":
            initSuspenseListRenderState(
              workInProgress2,
              false,
              null,
              null,
              void 0,
              nextProps
            );
            break;
          case "independent":
            workInProgress2.memoizedState = null;
            break;
          default:
            renderLanes2 = findLastContentRow(workInProgress2.child), null === renderLanes2 ? (revealOrder = workInProgress2.child, workInProgress2.child = null) : (revealOrder = renderLanes2.sibling, renderLanes2.sibling = null), initSuspenseListRenderState(
              workInProgress2,
              false,
              revealOrder,
              renderLanes2,
              tailMode,
              nextProps
            );
        }
        return workInProgress2.child;
      }
      function updateContextProvider(current, workInProgress2, renderLanes2) {
        var newProps = workInProgress2.pendingProps;
        pushProvider(workInProgress2, workInProgress2.type, newProps.value);
        reconcileChildren(current, workInProgress2, newProps.children, renderLanes2);
        return workInProgress2.child;
      }
      function bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2) {
        null !== current && (workInProgress2.dependencies = current.dependencies);
        workInProgressRootSkippedLanes |= workInProgress2.lanes;
        if (0 === (renderLanes2 & workInProgress2.childLanes))
          if (null !== current) {
            if (propagateParentContextChanges(
              current,
              workInProgress2,
              renderLanes2,
              false
            ), 0 === (renderLanes2 & workInProgress2.childLanes))
              return null;
          } else return null;
        if (null !== current && workInProgress2.child !== current.child)
          throw Error(formatProdErrorMessage(153));
        if (null !== workInProgress2.child) {
          current = workInProgress2.child;
          renderLanes2 = createWorkInProgress(current, current.pendingProps);
          workInProgress2.child = renderLanes2;
          for (renderLanes2.return = workInProgress2; null !== current.sibling; )
            current = current.sibling, renderLanes2 = renderLanes2.sibling = createWorkInProgress(current, current.pendingProps), renderLanes2.return = workInProgress2;
          renderLanes2.sibling = null;
        }
        return workInProgress2.child;
      }
      function checkScheduledUpdateOrContext(current, renderLanes2) {
        if (0 !== (current.lanes & renderLanes2)) return true;
        current = current.dependencies;
        return null !== current && checkIfContextChanged(current) ? true : false;
      }
      function attemptEarlyBailoutIfNoScheduledUpdate(current, workInProgress2, renderLanes2) {
        switch (workInProgress2.tag) {
          case 3:
            pushHostContainer(workInProgress2, workInProgress2.stateNode.containerInfo);
            pushProvider(workInProgress2, CacheContext, current.memoizedState.cache);
            resetHydrationState();
            break;
          case 27:
          case 5:
            pushHostContext(workInProgress2);
            break;
          case 4:
            pushHostContainer(workInProgress2, workInProgress2.stateNode.containerInfo);
            break;
          case 10:
            pushProvider(
              workInProgress2,
              workInProgress2.type,
              workInProgress2.memoizedProps.value
            );
            break;
          case 31:
            if (null !== workInProgress2.memoizedState)
              return workInProgress2.flags |= 128, pushDehydratedActivitySuspenseHandler(workInProgress2), null;
            break;
          case 13:
            var state$108 = workInProgress2.memoizedState;
            if (null !== state$108) {
              if (null !== state$108.dehydrated)
                return pushPrimaryTreeSuspenseHandler(workInProgress2), workInProgress2.flags |= 128, null;
              state$108 = propagateParentContextChanges(
                current,
                workInProgress2,
                renderLanes2,
                false
              );
              var primaryChildLanes = workInProgress2.child.childLanes;
              if (state$108 || 0 !== (renderLanes2 & primaryChildLanes))
                return updateSuspenseComponent(current, workInProgress2, renderLanes2);
              pushPrimaryTreeSuspenseHandler(workInProgress2);
              current = bailoutOnAlreadyFinishedWork(
                current,
                workInProgress2,
                renderLanes2
              );
              return null !== current ? current.sibling : null;
            }
            pushPrimaryTreeSuspenseHandler(workInProgress2);
            break;
          case 19:
            if (workInProgress2.flags & 128)
              return updateSuspenseListComponent(
                current,
                workInProgress2,
                renderLanes2
              );
            primaryChildLanes = 0 !== (current.flags & 128);
            state$108 = 0 !== (renderLanes2 & workInProgress2.childLanes);
            state$108 || (propagateParentContextChanges(
              current,
              workInProgress2,
              renderLanes2,
              false
            ), state$108 = 0 !== (renderLanes2 & workInProgress2.childLanes));
            if (primaryChildLanes) {
              if (state$108)
                return updateSuspenseListComponent(
                  current,
                  workInProgress2,
                  renderLanes2
                );
              workInProgress2.flags |= 128;
            }
            primaryChildLanes = workInProgress2.memoizedState;
            null !== primaryChildLanes && (primaryChildLanes.rendering = null, primaryChildLanes.tail = null, primaryChildLanes.lastEffect = null);
            pushSuspenseListContext(workInProgress2, suspenseStackCursor.current);
            if (state$108) break;
            else return null;
          case 22:
            return workInProgress2.lanes = 0, updateOffscreenComponent(
              current,
              workInProgress2,
              renderLanes2,
              workInProgress2.pendingProps
            );
          case 24:
            pushProvider(workInProgress2, CacheContext, current.memoizedState.cache);
        }
        return bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
      }
      function beginWork(current, workInProgress2, renderLanes2) {
        if (null !== current)
          if (current.memoizedProps !== workInProgress2.pendingProps)
            didReceiveUpdate = true;
          else {
            if (!checkScheduledUpdateOrContext(current, renderLanes2) && 0 === (workInProgress2.flags & 128))
              return didReceiveUpdate = false, attemptEarlyBailoutIfNoScheduledUpdate(
                current,
                workInProgress2,
                renderLanes2
              );
            didReceiveUpdate = 0 !== (current.flags & 131072) ? true : false;
          }
        else
          didReceiveUpdate = false, isHydrating && 0 !== (workInProgress2.flags & 1048576) && pushTreeId(workInProgress2, treeForkCount, workInProgress2.index);
        workInProgress2.lanes = 0;
        switch (workInProgress2.tag) {
          case 16:
            a: {
              var props = workInProgress2.pendingProps;
              current = resolveLazy(workInProgress2.elementType);
              workInProgress2.type = current;
              if ("function" === typeof current)
                shouldConstruct(current) ? (props = resolveClassComponentProps(current, props), workInProgress2.tag = 1, workInProgress2 = updateClassComponent(
                  null,
                  workInProgress2,
                  current,
                  props,
                  renderLanes2
                )) : (workInProgress2.tag = 0, workInProgress2 = updateFunctionComponent(
                  null,
                  workInProgress2,
                  current,
                  props,
                  renderLanes2
                ));
              else {
                if (void 0 !== current && null !== current) {
                  var $$typeof = current.$$typeof;
                  if ($$typeof === REACT_FORWARD_REF_TYPE) {
                    workInProgress2.tag = 11;
                    workInProgress2 = updateForwardRef(
                      null,
                      workInProgress2,
                      current,
                      props,
                      renderLanes2
                    );
                    break a;
                  } else if ($$typeof === REACT_MEMO_TYPE) {
                    workInProgress2.tag = 14;
                    workInProgress2 = updateMemoComponent(
                      null,
                      workInProgress2,
                      current,
                      props,
                      renderLanes2
                    );
                    break a;
                  } else if ($$typeof === REACT_CONTEXT_TYPE) {
                    workInProgress2.tag = 10;
                    workInProgress2.type = current;
                    workInProgress2 = updateContextProvider(
                      null,
                      workInProgress2,
                      renderLanes2
                    );
                    break a;
                  }
                }
                workInProgress2 = getComponentNameFromType(current) || current;
                throw Error(formatProdErrorMessage(306, workInProgress2, ""));
              }
            }
            return workInProgress2;
          case 0:
            return updateFunctionComponent(
              current,
              workInProgress2,
              workInProgress2.type,
              workInProgress2.pendingProps,
              renderLanes2
            );
          case 1:
            return props = workInProgress2.type, $$typeof = resolveClassComponentProps(
              props,
              workInProgress2.pendingProps
            ), updateClassComponent(
              current,
              workInProgress2,
              props,
              $$typeof,
              renderLanes2
            );
          case 3:
            a: {
              pushHostContainer(
                workInProgress2,
                workInProgress2.stateNode.containerInfo
              );
              if (null === current) throw Error(formatProdErrorMessage(387));
              props = workInProgress2.pendingProps;
              var prevState = workInProgress2.memoizedState;
              $$typeof = prevState.element;
              cloneUpdateQueue(current, workInProgress2);
              processUpdateQueue(workInProgress2, props, null, renderLanes2);
              var nextState = workInProgress2.memoizedState;
              props = nextState.cache;
              pushProvider(workInProgress2, CacheContext, props);
              props !== prevState.cache && propagateContextChanges(
                workInProgress2,
                [CacheContext],
                renderLanes2,
                true
              );
              suspendIfUpdateReadFromEntangledAsyncAction();
              props = nextState.element;
              if (prevState.isDehydrated)
                if (prevState = {
                  element: props,
                  isDehydrated: false,
                  cache: nextState.cache
                }, workInProgress2.updateQueue.baseState = prevState, workInProgress2.memoizedState = prevState, workInProgress2.flags & 256) {
                  workInProgress2 = mountHostRootWithoutHydrating(
                    current,
                    workInProgress2,
                    props,
                    renderLanes2
                  );
                  break a;
                } else if (props !== $$typeof) {
                  $$typeof = createCapturedValueAtFiber(
                    Error(formatProdErrorMessage(424)),
                    workInProgress2
                  );
                  queueHydrationError($$typeof);
                  workInProgress2 = mountHostRootWithoutHydrating(
                    current,
                    workInProgress2,
                    props,
                    renderLanes2
                  );
                  break a;
                } else {
                  current = workInProgress2.stateNode.containerInfo;
                  switch (current.nodeType) {
                    case 9:
                      current = current.body;
                      break;
                    default:
                      current = "HTML" === current.nodeName ? current.ownerDocument.body : current;
                  }
                  nextHydratableInstance = getNextHydratable(current.firstChild);
                  hydrationParentFiber = workInProgress2;
                  isHydrating = true;
                  hydrationErrors = null;
                  rootOrSingletonContext = true;
                  renderLanes2 = mountChildFibers(
                    workInProgress2,
                    null,
                    props,
                    renderLanes2
                  );
                  for (workInProgress2.child = renderLanes2; renderLanes2; )
                    renderLanes2.flags = renderLanes2.flags & -3 | 134221824, renderLanes2 = renderLanes2.sibling;
                }
              else {
                resetHydrationState();
                if (props === $$typeof) {
                  workInProgress2 = bailoutOnAlreadyFinishedWork(
                    current,
                    workInProgress2,
                    renderLanes2
                  );
                  break a;
                }
                reconcileChildren(current, workInProgress2, props, renderLanes2);
              }
              workInProgress2 = workInProgress2.child;
            }
            return workInProgress2;
          case 26:
            return markRef(current, workInProgress2), null === current ? (renderLanes2 = getResource(
              workInProgress2.type,
              null,
              workInProgress2.pendingProps,
              null
            )) ? workInProgress2.memoizedState = renderLanes2 : isHydrating || (workInProgress2.stateNode = createHoistableInstance(
              workInProgress2.type,
              workInProgress2.pendingProps,
              rootInstanceStackCursor.current,
              workInProgress2
            )) : workInProgress2.memoizedState = getResource(
              workInProgress2.type,
              current.memoizedProps,
              workInProgress2.pendingProps,
              current.memoizedState
            ), null;
          case 27:
            return pushHostContext(workInProgress2), null === current && isHydrating && (props = workInProgress2.stateNode = resolveSingletonInstance(
              workInProgress2.type,
              workInProgress2.pendingProps,
              rootInstanceStackCursor.current
            ), hydrationParentFiber = workInProgress2, rootOrSingletonContext = true, $$typeof = nextHydratableInstance, isSingletonScope(workInProgress2.type) ? (previousHydratableOnEnteringScopedSingleton = $$typeof, nextHydratableInstance = getNextHydratable(props.firstChild)) : nextHydratableInstance = $$typeof), reconcileChildren(
              current,
              workInProgress2,
              workInProgress2.pendingProps.children,
              renderLanes2
            ), markRef(current, workInProgress2), null === current && (workInProgress2.flags |= 4194304), workInProgress2.child;
          case 5:
            if (null === current && isHydrating) {
              if ($$typeof = props = nextHydratableInstance)
                props = canHydrateInstance(
                  props,
                  workInProgress2.type,
                  workInProgress2.pendingProps,
                  rootOrSingletonContext
                ), null !== props ? (workInProgress2.stateNode = props, hydrationParentFiber = workInProgress2, nextHydratableInstance = getNextHydratable(props.firstChild), rootOrSingletonContext = false, $$typeof = true) : $$typeof = false;
              $$typeof || throwOnHydrationMismatch(workInProgress2);
            }
            pushHostContext(workInProgress2);
            $$typeof = workInProgress2.type;
            prevState = workInProgress2.pendingProps;
            nextState = null !== current ? current.memoizedProps : null;
            props = prevState.children;
            shouldSetTextContent($$typeof, prevState) ? props = null : null !== nextState && shouldSetTextContent($$typeof, nextState) && (workInProgress2.flags |= 32);
            null !== workInProgress2.memoizedState && ($$typeof = renderWithHooks(
              current,
              workInProgress2,
              TransitionAwareHostComponent,
              null,
              null,
              renderLanes2
            ), HostTransitionContext._currentValue = $$typeof);
            markRef(current, workInProgress2);
            reconcileChildren(current, workInProgress2, props, renderLanes2);
            return workInProgress2.child;
          case 6:
            if (null === current && isHydrating) {
              if (current = renderLanes2 = nextHydratableInstance)
                renderLanes2 = canHydrateTextInstance(
                  renderLanes2,
                  workInProgress2.pendingProps,
                  rootOrSingletonContext
                ), null !== renderLanes2 ? (workInProgress2.stateNode = renderLanes2, hydrationParentFiber = workInProgress2, nextHydratableInstance = null, current = true) : current = false;
              current || throwOnHydrationMismatch(workInProgress2);
            }
            return null;
          case 13:
            return updateSuspenseComponent(current, workInProgress2, renderLanes2);
          case 4:
            return pushHostContainer(
              workInProgress2,
              workInProgress2.stateNode.containerInfo
            ), props = workInProgress2.pendingProps, null === current ? workInProgress2.child = reconcileChildFibers(
              workInProgress2,
              null,
              props,
              renderLanes2
            ) : reconcileChildren(current, workInProgress2, props, renderLanes2), workInProgress2.child;
          case 11:
            return updateForwardRef(
              current,
              workInProgress2,
              workInProgress2.type,
              workInProgress2.pendingProps,
              renderLanes2
            );
          case 7:
            return props = workInProgress2.pendingProps, markRef(current, workInProgress2), reconcileChildren(current, workInProgress2, props, renderLanes2), workInProgress2.child;
          case 8:
            return reconcileChildren(
              current,
              workInProgress2,
              workInProgress2.pendingProps.children,
              renderLanes2
            ), workInProgress2.child;
          case 12:
            return reconcileChildren(
              current,
              workInProgress2,
              workInProgress2.pendingProps.children,
              renderLanes2
            ), workInProgress2.child;
          case 10:
            return updateContextProvider(current, workInProgress2, renderLanes2);
          case 9:
            return $$typeof = workInProgress2.type._context, props = workInProgress2.pendingProps.children, prepareToReadContext(workInProgress2), $$typeof = readContext($$typeof), props = props($$typeof), workInProgress2.flags |= 1, reconcileChildren(current, workInProgress2, props, renderLanes2), workInProgress2.child;
          case 14:
            return updateMemoComponent(
              current,
              workInProgress2,
              workInProgress2.type,
              workInProgress2.pendingProps,
              renderLanes2
            );
          case 15:
            return updateSimpleMemoComponent(
              current,
              workInProgress2,
              workInProgress2.type,
              workInProgress2.pendingProps,
              renderLanes2
            );
          case 19:
            return updateSuspenseListComponent(current, workInProgress2, renderLanes2);
          case 31:
            return updateActivityComponent(current, workInProgress2, renderLanes2);
          case 22:
            return updateOffscreenComponent(
              current,
              workInProgress2,
              renderLanes2,
              workInProgress2.pendingProps
            );
          case 24:
            return prepareToReadContext(workInProgress2), props = readContext(CacheContext), null === current ? ($$typeof = peekCacheFromPool(), null === $$typeof && ($$typeof = workInProgressRoot, prevState = createCache(), $$typeof.pooledCache = prevState, prevState.refCount++, null !== prevState && ($$typeof.pooledCacheLanes |= renderLanes2), $$typeof = prevState), workInProgress2.memoizedState = { parent: props, cache: $$typeof }, initializeUpdateQueue(workInProgress2), pushProvider(workInProgress2, CacheContext, $$typeof)) : (0 !== (current.lanes & renderLanes2) && (cloneUpdateQueue(current, workInProgress2), processUpdateQueue(workInProgress2, null, null, renderLanes2), suspendIfUpdateReadFromEntangledAsyncAction()), $$typeof = current.memoizedState, prevState = workInProgress2.memoizedState, $$typeof.parent !== props ? ($$typeof = { parent: props, cache: props }, workInProgress2.memoizedState = $$typeof, 0 === workInProgress2.lanes && (workInProgress2.memoizedState = workInProgress2.updateQueue.baseState = $$typeof), pushProvider(workInProgress2, CacheContext, props)) : (props = prevState.cache, pushProvider(workInProgress2, CacheContext, props), props !== $$typeof.cache && propagateContextChanges(
              workInProgress2,
              [CacheContext],
              renderLanes2,
              true
            ))), reconcileChildren(
              current,
              workInProgress2,
              workInProgress2.pendingProps.children,
              renderLanes2
            ), workInProgress2.child;
          case 30:
            return null === workInProgress2.stateNode && (workInProgress2.stateNode = {
              autoName: null,
              paired: null,
              clones: null,
              ref: null
            }), props = workInProgress2.pendingProps, null != props.name && "auto" !== props.name ? workInProgress2.flags |= null === current ? 18882560 : 18874368 : isHydrating && pushMaterializedTreeId(workInProgress2), null !== current && current.memoizedProps.name !== props.name ? workInProgress2.flags |= 4194816 : markRef(current, workInProgress2), reconcileChildren(current, workInProgress2, props.children, renderLanes2), workInProgress2.child;
          case 29:
            throw workInProgress2.pendingProps;
        }
        throw Error(formatProdErrorMessage(156, workInProgress2.tag));
      }
      function markUpdate(workInProgress2) {
        workInProgress2.flags |= 4;
      }
      function preloadInstanceAndSuspendIfNeeded(workInProgress2, type, oldProps, newProps, renderLanes2) {
        var JSCompiler_temp;
        if (JSCompiler_temp = 0 !== (workInProgress2.mode & 32))
          JSCompiler_temp = null === oldProps ? maySuspendCommit(type, newProps) : maySuspendCommit(type, newProps) && (newProps.src !== oldProps.src || newProps.srcSet !== oldProps.srcSet);
        if (JSCompiler_temp) {
          if (workInProgress2.flags |= 16777216, (renderLanes2 & 335544128) === renderLanes2)
            if (workInProgress2.stateNode.complete) workInProgress2.flags |= 8192;
            else if (shouldRemainOnPreviousScreen()) workInProgress2.flags |= 8192;
            else
              throw suspendedThenable = noopSuspenseyCommitThenable, SuspenseyCommitException;
        } else workInProgress2.flags &= -16777217;
      }
      function preloadResourceAndSuspendIfNeeded(workInProgress2, resource) {
        if ("stylesheet" !== resource.type || 0 !== (resource.state.loading & 4))
          workInProgress2.flags &= -16777217;
        else if (workInProgress2.flags |= 16777216, !preloadResource(resource))
          if (shouldRemainOnPreviousScreen()) workInProgress2.flags |= 8192;
          else
            throw suspendedThenable = noopSuspenseyCommitThenable, SuspenseyCommitException;
      }
      function scheduleRetryEffect(workInProgress2, retryQueue) {
        null !== retryQueue && (workInProgress2.flags |= 4);
        workInProgress2.flags & 16384 && (retryQueue = 22 !== workInProgress2.tag ? claimNextRetryLane() : 536870912, workInProgress2.lanes |= retryQueue, workInProgressSuspendedRetryLanes |= retryQueue);
      }
      function cutOffTailIfNeeded(renderState, hasRenderedATailFallback) {
        if (!isHydrating)
          switch (renderState.tailMode) {
            case "visible":
              break;
            case "collapsed":
              for (var tailNode = renderState.tail, lastTailNode = null; null !== tailNode; )
                null !== tailNode.alternate && (lastTailNode = tailNode), tailNode = tailNode.sibling;
              null === lastTailNode ? hasRenderedATailFallback || null === renderState.tail ? renderState.tail = null : renderState.tail.sibling = null : lastTailNode.sibling = null;
              break;
            default:
              hasRenderedATailFallback = renderState.tail;
              for (tailNode = null; null !== hasRenderedATailFallback; )
                null !== hasRenderedATailFallback.alternate && (tailNode = hasRenderedATailFallback), hasRenderedATailFallback = hasRenderedATailFallback.sibling;
              null === tailNode ? renderState.tail = null : tailNode.sibling = null;
          }
      }
      function bubbleProperties(completedWork) {
        var didBailout = null !== completedWork.alternate && completedWork.alternate.child === completedWork.child, newChildLanes = 0, subtreeFlags = 0;
        if (didBailout)
          for (var child$113 = completedWork.child; null !== child$113; )
            newChildLanes |= child$113.lanes | child$113.childLanes, subtreeFlags |= child$113.subtreeFlags & 1206910976, subtreeFlags |= child$113.flags & 1206910976, child$113.return = completedWork, child$113 = child$113.sibling;
        else
          for (child$113 = completedWork.child; null !== child$113; )
            newChildLanes |= child$113.lanes | child$113.childLanes, subtreeFlags |= child$113.subtreeFlags, subtreeFlags |= child$113.flags, child$113.return = completedWork, child$113 = child$113.sibling;
        completedWork.subtreeFlags |= subtreeFlags;
        completedWork.childLanes = newChildLanes;
        return didBailout;
      }
      function completeWork(current, workInProgress2, renderLanes2) {
        var newProps = workInProgress2.pendingProps;
        popTreeContext(workInProgress2);
        switch (workInProgress2.tag) {
          case 16:
          case 15:
          case 0:
          case 11:
          case 7:
          case 8:
          case 12:
          case 9:
          case 14:
            return bubbleProperties(workInProgress2), null;
          case 1:
            return bubbleProperties(workInProgress2), null;
          case 3:
            renderLanes2 = workInProgress2.stateNode;
            newProps = null;
            null !== current && (newProps = current.memoizedState.cache);
            workInProgress2.memoizedState.cache !== newProps && (workInProgress2.flags |= 2048);
            popProvider(CacheContext);
            popHostContainer();
            renderLanes2.pendingContext && (renderLanes2.context = renderLanes2.pendingContext, renderLanes2.pendingContext = null);
            if (null === current || null === current.child)
              popHydrationState(workInProgress2) ? markUpdate(workInProgress2) : null === current || current.memoizedState.isDehydrated && 0 === (workInProgress2.flags & 256) || (workInProgress2.flags |= 1024, upgradeHydrationErrorsToRecoverable());
            bubbleProperties(workInProgress2);
            return null;
          case 26:
            var type = workInProgress2.type, nextResource = workInProgress2.memoizedState;
            null === current ? (markUpdate(workInProgress2), null !== nextResource ? (bubbleProperties(workInProgress2), preloadResourceAndSuspendIfNeeded(workInProgress2, nextResource)) : (bubbleProperties(workInProgress2), preloadInstanceAndSuspendIfNeeded(
              workInProgress2,
              type,
              null,
              newProps,
              renderLanes2
            ))) : nextResource ? nextResource !== current.memoizedState ? (markUpdate(workInProgress2), bubbleProperties(workInProgress2), preloadResourceAndSuspendIfNeeded(workInProgress2, nextResource)) : (bubbleProperties(workInProgress2), workInProgress2.flags &= -16777217) : (current = current.memoizedProps, current !== newProps && markUpdate(workInProgress2), bubbleProperties(workInProgress2), preloadInstanceAndSuspendIfNeeded(
              workInProgress2,
              type,
              current,
              newProps,
              renderLanes2
            ));
            return null;
          case 27:
            popHostContext(workInProgress2);
            renderLanes2 = rootInstanceStackCursor.current;
            type = workInProgress2.type;
            if (null !== current && null != workInProgress2.stateNode)
              current.memoizedProps !== newProps && markUpdate(workInProgress2);
            else {
              if (!newProps) {
                if (null === workInProgress2.stateNode)
                  throw Error(formatProdErrorMessage(166));
                bubbleProperties(workInProgress2);
                workInProgress2.subtreeFlags &= -33554433;
                return null;
              }
              current = contextStackCursor.current;
              popHydrationState(workInProgress2) ? prepareToHydrateHostInstance(workInProgress2, current) : (current = resolveSingletonInstance(type, newProps, renderLanes2), workInProgress2.stateNode = current, markUpdate(workInProgress2));
            }
            bubbleProperties(workInProgress2);
            workInProgress2.subtreeFlags &= -33554433;
            return null;
          case 5:
            popHostContext(workInProgress2);
            type = workInProgress2.type;
            if (null !== current && null != workInProgress2.stateNode)
              current.memoizedProps !== newProps && markUpdate(workInProgress2);
            else {
              if (!newProps) {
                if (null === workInProgress2.stateNode)
                  throw Error(formatProdErrorMessage(166));
                bubbleProperties(workInProgress2);
                workInProgress2.subtreeFlags &= -33554433;
                return null;
              }
              nextResource = contextStackCursor.current;
              if (popHydrationState(workInProgress2))
                prepareToHydrateHostInstance(workInProgress2, nextResource);
              else {
                var ownerDocument = getOwnerDocumentFromRootContainer(
                  rootInstanceStackCursor.current
                );
                switch (nextResource) {
                  case 1:
                    nextResource = ownerDocument.createElementNS(
                      "http://www.w3.org/2000/svg",
                      type
                    );
                    break;
                  case 2:
                    nextResource = ownerDocument.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      type
                    );
                    break;
                  default:
                    switch (type) {
                      case "svg":
                        nextResource = ownerDocument.createElementNS(
                          "http://www.w3.org/2000/svg",
                          type
                        );
                        break;
                      case "math":
                        nextResource = ownerDocument.createElementNS(
                          "http://www.w3.org/1998/Math/MathML",
                          type
                        );
                        break;
                      case "script":
                        nextResource = ownerDocument.createElement("div");
                        nextResource.innerHTML = "<script><\/script>";
                        nextResource = nextResource.removeChild(
                          nextResource.firstChild
                        );
                        break;
                      case "select":
                        nextResource = "string" === typeof newProps.is ? ownerDocument.createElement("select", {
                          is: newProps.is
                        }) : ownerDocument.createElement("select");
                        newProps.multiple ? nextResource.multiple = true : newProps.size && (nextResource.size = newProps.size);
                        break;
                      default:
                        nextResource = "string" === typeof newProps.is ? ownerDocument.createElement(type, { is: newProps.is }) : ownerDocument.createElement(type);
                    }
                }
                nextResource[internalInstanceKey] = workInProgress2;
                nextResource[internalPropsKey] = newProps;
                a: for (ownerDocument = workInProgress2.child; null !== ownerDocument; ) {
                  if (5 === ownerDocument.tag || 6 === ownerDocument.tag)
                    nextResource.appendChild(ownerDocument.stateNode);
                  else if (4 !== ownerDocument.tag && 27 !== ownerDocument.tag && null !== ownerDocument.child) {
                    ownerDocument.child.return = ownerDocument;
                    ownerDocument = ownerDocument.child;
                    continue;
                  }
                  if (ownerDocument === workInProgress2) break a;
                  for (; null === ownerDocument.sibling; ) {
                    if (null === ownerDocument.return || ownerDocument.return === workInProgress2)
                      break a;
                    ownerDocument = ownerDocument.return;
                  }
                  ownerDocument.sibling.return = ownerDocument.return;
                  ownerDocument = ownerDocument.sibling;
                }
                workInProgress2.stateNode = nextResource;
                a: switch (setInitialProperties(nextResource, type, newProps), type) {
                  case "button":
                  case "input":
                  case "select":
                  case "textarea":
                    newProps = !!newProps.autoFocus;
                    break a;
                  case "img":
                    newProps = true;
                    break a;
                  default:
                    newProps = false;
                }
                newProps && markUpdate(workInProgress2);
              }
            }
            bubbleProperties(workInProgress2);
            workInProgress2.subtreeFlags &= -33554433;
            preloadInstanceAndSuspendIfNeeded(
              workInProgress2,
              workInProgress2.type,
              null === current ? null : current.memoizedProps,
              workInProgress2.pendingProps,
              renderLanes2
            );
            return null;
          case 6:
            if (current && null != workInProgress2.stateNode)
              current.memoizedProps !== newProps && markUpdate(workInProgress2);
            else {
              if ("string" !== typeof newProps && null === workInProgress2.stateNode)
                throw Error(formatProdErrorMessage(166));
              current = rootInstanceStackCursor.current;
              if (popHydrationState(workInProgress2)) {
                current = workInProgress2.stateNode;
                renderLanes2 = workInProgress2.memoizedProps;
                newProps = null;
                type = hydrationParentFiber;
                if (null !== type)
                  switch (type.tag) {
                    case 27:
                    case 5:
                      newProps = type.memoizedProps;
                  }
                current[internalInstanceKey] = workInProgress2;
                current = current.nodeValue === renderLanes2 || null !== newProps && true === newProps.suppressHydrationWarning || checkForUnmatchedText(current.nodeValue, renderLanes2) ? true : false;
                current || throwOnHydrationMismatch(workInProgress2, true);
              } else
                current = getOwnerDocumentFromRootContainer(current).createTextNode(
                  newProps
                ), current[internalInstanceKey] = workInProgress2, workInProgress2.stateNode = current;
            }
            bubbleProperties(workInProgress2);
            return null;
          case 31:
            renderLanes2 = workInProgress2.memoizedState;
            if (null === current || null !== current.memoizedState) {
              newProps = popHydrationState(workInProgress2);
              if (null !== renderLanes2) {
                if (null === current) {
                  if (!newProps) throw Error(formatProdErrorMessage(318));
                  current = workInProgress2.memoizedState;
                  current = null !== current ? current.dehydrated : null;
                  if (!current) throw Error(formatProdErrorMessage(557));
                  current[internalInstanceKey] = workInProgress2;
                } else
                  resetHydrationState(), 0 === (workInProgress2.flags & 128) && (workInProgress2.memoizedState = null), workInProgress2.flags |= 4;
                bubbleProperties(workInProgress2);
                current = false;
              } else
                renderLanes2 = upgradeHydrationErrorsToRecoverable(), null !== current && null !== current.memoizedState && (current.memoizedState.hydrationErrors = renderLanes2), current = true;
              if (!current) {
                if (workInProgress2.flags & 256)
                  return popSuspenseHandler(workInProgress2), workInProgress2;
                popSuspenseHandler(workInProgress2);
                return null;
              }
              if (0 !== (workInProgress2.flags & 128))
                throw Error(formatProdErrorMessage(558));
            }
            bubbleProperties(workInProgress2);
            return null;
          case 13:
            newProps = workInProgress2.memoizedState;
            if (null === current || null !== current.memoizedState && null !== current.memoizedState.dehydrated) {
              type = popHydrationState(workInProgress2);
              if (null !== newProps && null !== newProps.dehydrated) {
                if (null === current) {
                  if (!type) throw Error(formatProdErrorMessage(318));
                  type = workInProgress2.memoizedState;
                  type = null !== type ? type.dehydrated : null;
                  if (!type) throw Error(formatProdErrorMessage(317));
                  type[internalInstanceKey] = workInProgress2;
                } else
                  resetHydrationState(), 0 === (workInProgress2.flags & 128) && (workInProgress2.memoizedState = null), workInProgress2.flags |= 4;
                bubbleProperties(workInProgress2);
                type = false;
              } else
                type = upgradeHydrationErrorsToRecoverable(), null !== current && null !== current.memoizedState && (current.memoizedState.hydrationErrors = type), type = true;
              if (!type) {
                if (workInProgress2.flags & 256)
                  return popSuspenseHandler(workInProgress2), workInProgress2;
                popSuspenseHandler(workInProgress2);
                return null;
              }
            }
            popSuspenseHandler(workInProgress2);
            if (0 !== (workInProgress2.flags & 128))
              return workInProgress2.lanes = renderLanes2, workInProgress2;
            renderLanes2 = null !== newProps;
            current = null !== current && null !== current.memoizedState;
            renderLanes2 && (newProps = workInProgress2.child, type = null, null !== newProps.alternate && null !== newProps.alternate.memoizedState && null !== newProps.alternate.memoizedState.cachePool && (type = newProps.alternate.memoizedState.cachePool.pool), nextResource = null, null !== newProps.memoizedState && null !== newProps.memoizedState.cachePool && (nextResource = newProps.memoizedState.cachePool.pool), nextResource !== type && (newProps.flags |= 2048));
            renderLanes2 !== current && renderLanes2 && (workInProgress2.child.flags |= 8192);
            scheduleRetryEffect(workInProgress2, workInProgress2.updateQueue);
            bubbleProperties(workInProgress2);
            return null;
          case 4:
            return popHostContainer(), null === current && listenToAllSupportedEvents(workInProgress2.stateNode.containerInfo), workInProgress2.flags |= 67108864, bubbleProperties(workInProgress2), null;
          case 10:
            return popProvider(workInProgress2.type), bubbleProperties(workInProgress2), null;
          case 19:
            popSuspenseListContext(workInProgress2);
            newProps = workInProgress2.memoizedState;
            if (null === newProps) return bubbleProperties(workInProgress2), null;
            type = 0 !== (workInProgress2.flags & 128);
            nextResource = newProps.rendering;
            if (null === nextResource)
              if (type) cutOffTailIfNeeded(newProps, false);
              else {
                if (0 !== workInProgressRootExitStatus || null !== current && 0 !== (current.flags & 128))
                  for (current = workInProgress2.child; null !== current; ) {
                    nextResource = findFirstSuspended(current);
                    if (null !== nextResource) {
                      workInProgress2.flags |= 128;
                      cutOffTailIfNeeded(newProps, false);
                      current = nextResource.updateQueue;
                      workInProgress2.updateQueue = current;
                      scheduleRetryEffect(workInProgress2, current);
                      workInProgress2.subtreeFlags = 0;
                      current = renderLanes2;
                      for (renderLanes2 = workInProgress2.child; null !== renderLanes2; )
                        resetWorkInProgress(renderLanes2, current), renderLanes2 = renderLanes2.sibling;
                      pushSuspenseListContext(
                        workInProgress2,
                        suspenseStackCursor.current & 1 | 2
                      );
                      isHydrating && pushTreeFork(workInProgress2, newProps.treeForkCount);
                      return workInProgress2.child;
                    }
                    current = current.sibling;
                  }
                null !== newProps.tail && now() > workInProgressRootRenderTargetTime && (workInProgress2.flags |= 128, type = true, cutOffTailIfNeeded(newProps, false), workInProgress2.lanes = 4194304);
              }
            else {
              if (!type)
                if (current = findFirstSuspended(nextResource), null !== current) {
                  if (workInProgress2.flags |= 128, type = true, current = current.updateQueue, workInProgress2.updateQueue = current, scheduleRetryEffect(workInProgress2, current), cutOffTailIfNeeded(newProps, true), null === newProps.tail && "collapsed" !== newProps.tailMode && "visible" !== newProps.tailMode && !nextResource.alternate && !isHydrating)
                    return bubbleProperties(workInProgress2), null;
                } else
                  2 * now() - newProps.renderingStartTime > workInProgressRootRenderTargetTime && 536870912 !== renderLanes2 && (workInProgress2.flags |= 128, type = true, cutOffTailIfNeeded(newProps, false), workInProgress2.lanes = 4194304);
              newProps.isBackwards ? (nextResource.sibling = workInProgress2.child, workInProgress2.child = nextResource) : (current = newProps.last, null !== current ? current.sibling = nextResource : workInProgress2.child = nextResource, newProps.last = nextResource);
            }
            if (null !== newProps.tail) {
              current = newProps.tail;
              a: {
                for (renderLanes2 = current; null !== renderLanes2; ) {
                  if (null !== renderLanes2.alternate) {
                    renderLanes2 = false;
                    break a;
                  }
                  renderLanes2 = renderLanes2.sibling;
                }
                renderLanes2 = true;
              }
              newProps.rendering = current;
              newProps.tail = current.sibling;
              newProps.renderingStartTime = now();
              current.sibling = null;
              nextResource = suspenseStackCursor.current;
              nextResource = type ? nextResource & 1 | 2 : nextResource & 1;
              "visible" === newProps.tailMode || "collapsed" === newProps.tailMode || !renderLanes2 || isHydrating ? pushSuspenseListContext(workInProgress2, nextResource) : (renderLanes2 = nextResource, push(suspenseHandlerStackCursor, workInProgress2), push(suspenseStackCursor, renderLanes2), null === shellBoundary && (shellBoundary = workInProgress2));
              isHydrating && pushTreeFork(workInProgress2, newProps.treeForkCount);
              return current;
            }
            bubbleProperties(workInProgress2);
            return null;
          case 22:
          case 23:
            return popSuspenseHandler(workInProgress2), popHiddenContext(), newProps = null !== workInProgress2.memoizedState, null !== current ? null !== current.memoizedState !== newProps && (workInProgress2.flags |= 8192) : newProps && (workInProgress2.flags |= 8192), newProps ? 0 !== (renderLanes2 & 536870912) && 0 === (workInProgress2.flags & 128) && (bubbleProperties(workInProgress2), workInProgress2.subtreeFlags & 6 && (workInProgress2.flags |= 8192)) : bubbleProperties(workInProgress2), renderLanes2 = workInProgress2.updateQueue, null !== renderLanes2 && scheduleRetryEffect(workInProgress2, renderLanes2.retryQueue), renderLanes2 = null, null !== current && null !== current.memoizedState && null !== current.memoizedState.cachePool && (renderLanes2 = current.memoizedState.cachePool.pool), newProps = null, null !== workInProgress2.memoizedState && null !== workInProgress2.memoizedState.cachePool && (newProps = workInProgress2.memoizedState.cachePool.pool), newProps !== renderLanes2 && (workInProgress2.flags |= 2048), null !== current && pop(resumedCache), null;
          case 24:
            return renderLanes2 = null, null !== current && (renderLanes2 = current.memoizedState.cache), workInProgress2.memoizedState.cache !== renderLanes2 && (workInProgress2.flags |= 2048), popProvider(CacheContext), bubbleProperties(workInProgress2), null;
          case 25:
            return null;
          case 30:
            return workInProgress2.flags |= 33554432, bubbleProperties(workInProgress2), null;
        }
        throw Error(formatProdErrorMessage(156, workInProgress2.tag));
      }
      function unwindWork(current, workInProgress2) {
        popTreeContext(workInProgress2);
        switch (workInProgress2.tag) {
          case 1:
            return current = workInProgress2.flags, current & 65536 ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
          case 3:
            return popProvider(CacheContext), popHostContainer(), current = workInProgress2.flags, 0 !== (current & 65536) && 0 === (current & 128) ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
          case 26:
          case 27:
          case 5:
            return popHostContext(workInProgress2), null;
          case 31:
            if (null !== workInProgress2.memoizedState) {
              popSuspenseHandler(workInProgress2);
              if (null === workInProgress2.alternate)
                throw Error(formatProdErrorMessage(340));
              resetHydrationState();
            }
            current = workInProgress2.flags;
            return current & 65536 ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
          case 13:
            popSuspenseHandler(workInProgress2);
            current = workInProgress2.memoizedState;
            if (null !== current && null !== current.dehydrated) {
              if (null === workInProgress2.alternate)
                throw Error(formatProdErrorMessage(340));
              resetHydrationState();
            }
            current = workInProgress2.flags;
            return current & 65536 ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
          case 19:
            return popSuspenseListContext(workInProgress2), current = workInProgress2.flags, current & 65536 ? (workInProgress2.flags = current & -65537 | 128, current = workInProgress2.memoizedState, null !== current && (current.rendering = null, current.tail = null), workInProgress2.flags |= 4, workInProgress2) : null;
          case 4:
            return popHostContainer(), null;
          case 10:
            return popProvider(workInProgress2.type), null;
          case 22:
          case 23:
            return popSuspenseHandler(workInProgress2), popHiddenContext(), null !== current && pop(resumedCache), current = workInProgress2.flags, current & 65536 ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
          case 24:
            return popProvider(CacheContext), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function unwindInterruptedWork(current, interruptedWork) {
        popTreeContext(interruptedWork);
        switch (interruptedWork.tag) {
          case 3:
            popProvider(CacheContext);
            popHostContainer();
            break;
          case 26:
          case 27:
          case 5:
            popHostContext(interruptedWork);
            break;
          case 4:
            popHostContainer();
            break;
          case 31:
            null !== interruptedWork.memoizedState && popSuspenseHandler(interruptedWork);
            break;
          case 13:
            popSuspenseHandler(interruptedWork);
            break;
          case 19:
            popSuspenseListContext(interruptedWork);
            break;
          case 10:
            popProvider(interruptedWork.type);
            break;
          case 22:
          case 23:
            popSuspenseHandler(interruptedWork);
            popHiddenContext();
            null !== current && pop(resumedCache);
            break;
          case 24:
            popProvider(CacheContext);
        }
      }
      function commitHookEffectListMount(flags, finishedWork) {
        try {
          var updateQueue = finishedWork.updateQueue, lastEffect = null !== updateQueue ? updateQueue.lastEffect : null;
          if (null !== lastEffect) {
            var firstEffect = lastEffect.next;
            updateQueue = firstEffect;
            do {
              if ((updateQueue.tag & flags) === flags) {
                lastEffect = void 0;
                var create = updateQueue.create, inst = updateQueue.inst;
                lastEffect = create();
                inst.destroy = lastEffect;
              }
              updateQueue = updateQueue.next;
            } while (updateQueue !== firstEffect);
          }
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      function commitHookEffectListUnmount(flags, finishedWork, nearestMountedAncestor$jscomp$0) {
        try {
          var updateQueue = finishedWork.updateQueue, lastEffect = null !== updateQueue ? updateQueue.lastEffect : null;
          if (null !== lastEffect) {
            var firstEffect = lastEffect.next;
            updateQueue = firstEffect;
            do {
              if ((updateQueue.tag & flags) === flags) {
                var inst = updateQueue.inst, destroy = inst.destroy;
                if (void 0 !== destroy) {
                  inst.destroy = void 0;
                  lastEffect = finishedWork;
                  var nearestMountedAncestor = nearestMountedAncestor$jscomp$0, destroy_ = destroy;
                  try {
                    destroy_();
                  } catch (error) {
                    captureCommitPhaseError(
                      lastEffect,
                      nearestMountedAncestor,
                      error
                    );
                  }
                }
              }
              updateQueue = updateQueue.next;
            } while (updateQueue !== firstEffect);
          }
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      function commitClassCallbacks(finishedWork) {
        var updateQueue = finishedWork.updateQueue;
        if (null !== updateQueue) {
          var instance = finishedWork.stateNode;
          try {
            commitCallbacks(updateQueue, instance);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
      }
      function safelyCallComponentWillUnmount(current, nearestMountedAncestor, instance) {
        instance.props = resolveClassComponentProps(
          current.type,
          current.memoizedProps
        );
        instance.state = current.memoizedState;
        try {
          instance.componentWillUnmount();
        } catch (error) {
          captureCommitPhaseError(current, nearestMountedAncestor, error);
        }
      }
      function safelyAttachRef(current, nearestMountedAncestor) {
        try {
          var ref = current.ref;
          if (null !== ref) {
            switch (current.tag) {
              case 26:
              case 27:
              case 5:
                var instanceToUse = current.stateNode;
                break;
              case 30:
                var instance = current.stateNode, name = getViewTransitionName(current.memoizedProps, instance);
                if (null === instance.ref || instance.ref.name !== name)
                  instance.ref = createViewTransitionInstance(name);
                instanceToUse = instance.ref;
                break;
              case 7:
                if (null === current.stateNode) {
                  var fragmentInstance = new FragmentInstance(current);
                  traverseVisibleInstancesAndTextInstances(
                    current.child,
                    false,
                    addFragmentHandleToFiber,
                    fragmentInstance,
                    void 0,
                    void 0
                  );
                  current.stateNode = fragmentInstance;
                }
                instanceToUse = current.stateNode;
                break;
              default:
                instanceToUse = current.stateNode;
            }
            "function" === typeof ref ? current.refCleanup = ref(instanceToUse) : ref.current = instanceToUse;
          }
        } catch (error) {
          captureCommitPhaseError(current, nearestMountedAncestor, error);
        }
      }
      function safelyDetachRef(current, nearestMountedAncestor) {
        var ref = current.ref, refCleanup = current.refCleanup;
        if (null !== ref)
          if ("function" === typeof refCleanup)
            try {
              refCleanup();
            } catch (error) {
              captureCommitPhaseError(current, nearestMountedAncestor, error);
            } finally {
              current.refCleanup = null, current = current.alternate, null != current && (current.refCleanup = null);
            }
          else if ("function" === typeof ref)
            try {
              ref(null);
            } catch (error$148) {
              captureCommitPhaseError(current, nearestMountedAncestor, error$148);
            }
          else ref.current = null;
      }
      function commitNewChildToFragmentInstances(fiber, parentFragmentInstances) {
        if ((5 === fiber.tag || 27 === fiber.tag || 6 === fiber.tag) && null === fiber.alternate && null !== parentFragmentInstances)
          for (var i = 0; i < parentFragmentInstances.length; i++)
            commitNewChildToFragmentInstance(
              fiber.stateNode,
              parentFragmentInstances[i]
            );
      }
      function commitFragmentInstanceInsertionEffects(fiber) {
        for (var parent = fiber.return; null !== parent; ) {
          isFragmentInstanceParent(parent) && commitNewChildToFragmentInstance(fiber.stateNode, parent.stateNode);
          if (isFragmentInstanceHostBoundary(parent)) break;
          parent = parent.return;
        }
      }
      function commitFragmentInstanceDeletionEffects(fiber) {
        for (var parent = fiber.return; null !== parent; ) {
          isFragmentInstanceParent(parent) && deleteChildFromFragmentInstance(fiber.stateNode, parent.stateNode);
          if (isFragmentInstanceHostBoundary(parent)) break;
          parent = parent.return;
        }
      }
      function isFragmentInstanceHostBoundary(fiber) {
        return 5 === fiber.tag || 3 === fiber.tag || 27 === fiber.tag;
      }
      function isFragmentInstanceParent(fiber) {
        return fiber && 7 === fiber.tag && null !== fiber.stateNode;
      }
      function commitHostMount(finishedWork) {
        var type = finishedWork.type, props = finishedWork.memoizedProps, instance = finishedWork.stateNode;
        try {
          a: switch (type) {
            case "button":
            case "input":
            case "select":
            case "textarea":
              props.autoFocus && instance.focus();
              break a;
            case "img":
              props.src ? instance.src = props.src : props.srcSet && (instance.srcset = props.srcSet);
          }
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      function commitHostUpdate(finishedWork, newProps, oldProps) {
        try {
          var domElement = finishedWork.stateNode;
          updateProperties(domElement, finishedWork.type, oldProps, newProps);
          domElement[internalPropsKey] = newProps;
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      function isHostParent(fiber) {
        return 5 === fiber.tag || 3 === fiber.tag || 26 === fiber.tag || 27 === fiber.tag && isSingletonScope(fiber.type) || 4 === fiber.tag;
      }
      function getHostSibling(fiber) {
        a: for (; ; ) {
          for (; null === fiber.sibling; ) {
            if (null === fiber.return || isHostParent(fiber.return)) return null;
            fiber = fiber.return;
          }
          fiber.sibling.return = fiber.return;
          for (fiber = fiber.sibling; 5 !== fiber.tag && 6 !== fiber.tag && 18 !== fiber.tag; ) {
            if (27 === fiber.tag && isSingletonScope(fiber.type)) continue a;
            if (fiber.flags & 2) continue a;
            if (null === fiber.child || 4 === fiber.tag) continue a;
            else fiber.child.return = fiber, fiber = fiber.child;
          }
          if (!(fiber.flags & 2)) return fiber.stateNode;
        }
      }
      function insertOrAppendPlacementNodeIntoContainer(node, before, parent, parentFragmentInstances) {
        var tag = node.tag;
        if (5 === tag || 6 === tag)
          tag = node.stateNode, before ? (9 === parent.nodeType ? parent.body : "HTML" === parent.nodeName ? parent.ownerDocument.body : parent).insertBefore(tag, before) : (before = 9 === parent.nodeType ? parent.body : "HTML" === parent.nodeName ? parent.ownerDocument.body : parent, before.appendChild(tag), parent = parent._reactRootContainer, null !== parent && void 0 !== parent || null !== before.onclick || (before.onclick = noop$1)), commitNewChildToFragmentInstances(node, parentFragmentInstances), viewTransitionMutationContext = true;
        else if (4 !== tag && (27 === tag && (commitNewChildToFragmentInstances(node, parentFragmentInstances), parentFragmentInstances = null, isSingletonScope(node.type) && (parent = node.stateNode, before = null)), node = node.child, null !== node))
          for (insertOrAppendPlacementNodeIntoContainer(
            node,
            before,
            parent,
            parentFragmentInstances
          ), node = node.sibling; null !== node; )
            insertOrAppendPlacementNodeIntoContainer(
              node,
              before,
              parent,
              parentFragmentInstances
            ), node = node.sibling;
      }
      function insertOrAppendPlacementNode(node, before, parent, parentFragmentInstances) {
        var tag = node.tag;
        if (5 === tag || 6 === tag)
          tag = node.stateNode, before ? parent.insertBefore(tag, before) : parent.appendChild(tag), commitNewChildToFragmentInstances(node, parentFragmentInstances), viewTransitionMutationContext = true;
        else if (4 !== tag && (27 === tag && (commitNewChildToFragmentInstances(node, parentFragmentInstances), parentFragmentInstances = null, isSingletonScope(node.type) && (parent = node.stateNode)), node = node.child, null !== node))
          for (insertOrAppendPlacementNode(
            node,
            before,
            parent,
            parentFragmentInstances
          ), node = node.sibling; null !== node; )
            insertOrAppendPlacementNode(
              node,
              before,
              parent,
              parentFragmentInstances
            ), node = node.sibling;
      }
      function commitHostSingletonAcquisition(finishedWork) {
        var singleton = finishedWork.stateNode, props = finishedWork.memoizedProps;
        try {
          for (var type = finishedWork.type, attributes = singleton.attributes; attributes.length; )
            singleton.removeAttributeNode(attributes[0]);
          setInitialProperties(singleton, type, props);
          singleton[internalInstanceKey] = finishedWork;
          singleton[internalPropsKey] = props;
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      var shouldStartViewTransition = false;
      var appearingViewTransitions = null;
      function trackEnterViewTransitions(placement) {
        if (30 === placement.tag || 0 !== (placement.subtreeFlags & 33554432))
          shouldStartViewTransition = true;
      }
      var viewTransitionCancelableChildren = null;
      function pushViewTransitionCancelableScope() {
        var prevChildren = viewTransitionCancelableChildren;
        viewTransitionCancelableChildren = null;
        return prevChildren;
      }
      var viewTransitionHostInstanceIdx = 0;
      function applyViewTransitionToHostInstances(fiber, name, className, collectMeasurements, stopAtNestedViewTransitions) {
        viewTransitionHostInstanceIdx = 0;
        return applyViewTransitionToHostInstancesRecursive(
          fiber.child,
          name,
          className,
          collectMeasurements,
          stopAtNestedViewTransitions
        );
      }
      function applyViewTransitionToHostInstancesRecursive(child, name, className, collectMeasurements, stopAtNestedViewTransitions) {
        for (var inViewport = false; null !== child; ) {
          if (5 === child.tag) {
            var instance = child.stateNode;
            if (null !== collectMeasurements) {
              var measurement = measureInstance(instance);
              collectMeasurements.push(measurement);
              measurement.view && (inViewport = true);
            } else
              inViewport || measureInstance(instance).view && (inViewport = true);
            shouldStartViewTransition = true;
            applyViewTransitionName(
              instance,
              0 === viewTransitionHostInstanceIdx ? name : name + "_" + viewTransitionHostInstanceIdx,
              className
            );
            viewTransitionHostInstanceIdx++;
          } else if (22 !== child.tag || null === child.memoizedState)
            30 === child.tag && stopAtNestedViewTransitions || applyViewTransitionToHostInstancesRecursive(
              child.child,
              name,
              className,
              collectMeasurements,
              stopAtNestedViewTransitions
            ) && (inViewport = true);
          child = child.sibling;
        }
        return inViewport;
      }
      function restoreViewTransitionOnHostInstances(child, stopAtNestedViewTransitions) {
        for (; null !== child; ) {
          if (5 === child.tag)
            restoreViewTransitionName(child.stateNode, child.memoizedProps);
          else if (22 !== child.tag || null === child.memoizedState)
            30 === child.tag && stopAtNestedViewTransitions || restoreViewTransitionOnHostInstances(
              child.child,
              stopAtNestedViewTransitions
            );
          child = child.sibling;
        }
      }
      function commitAppearingPairViewTransitions(placement) {
        if (0 !== (placement.subtreeFlags & 18874368))
          for (placement = placement.child; null !== placement; ) {
            if (22 !== placement.tag || null === placement.memoizedState) {
              if (commitAppearingPairViewTransitions(placement), 30 === placement.tag && 0 !== (placement.flags & 18874368) && placement.stateNode.paired) {
                var props = placement.memoizedProps;
                if (null == props.name || "auto" === props.name)
                  throw Error(formatProdErrorMessage(544));
                var name = props.name;
                props = getViewTransitionClassName(props.default, props.share);
                "none" !== props && (applyViewTransitionToHostInstances(
                  placement,
                  name,
                  props,
                  null,
                  false
                ) || restoreViewTransitionOnHostInstances(placement.child, false));
              }
            }
            placement = placement.sibling;
          }
      }
      function commitEnterViewTransitions(placement, gesture) {
        if (30 === placement.tag) {
          var state = placement.stateNode, props = placement.memoizedProps, name = getViewTransitionName(props, state), className = getViewTransitionClassName(
            props.default,
            state.paired ? props.share : props.enter
          );
          "none" !== className ? applyViewTransitionToHostInstances(placement, name, className, null, false) ? (commitAppearingPairViewTransitions(placement), state.paired || gesture || scheduleViewTransitionEvent(placement, props.onEnter)) : restoreViewTransitionOnHostInstances(placement.child, false) : commitAppearingPairViewTransitions(placement);
        } else if (0 !== (placement.subtreeFlags & 33554432))
          for (placement = placement.child; null !== placement; )
            commitEnterViewTransitions(placement, gesture), placement = placement.sibling;
        else commitAppearingPairViewTransitions(placement);
      }
      function commitDeletedPairViewTransitions(deletion) {
        if (null !== appearingViewTransitions && 0 !== appearingViewTransitions.size) {
          var pairs = appearingViewTransitions;
          if (0 !== (deletion.subtreeFlags & 18874368))
            for (deletion = deletion.child; null !== deletion; ) {
              if (22 !== deletion.tag || null === deletion.memoizedState) {
                if (30 === deletion.tag && 0 !== (deletion.flags & 18874368)) {
                  var props = deletion.memoizedProps, name = props.name;
                  if (null != name && "auto" !== name) {
                    var pair = pairs.get(name);
                    if (void 0 !== pair) {
                      var className = getViewTransitionClassName(
                        props.default,
                        props.share
                      );
                      "none" !== className && (applyViewTransitionToHostInstances(
                        deletion,
                        name,
                        className,
                        null,
                        false
                      ) ? (className = deletion.stateNode, pair.paired = className, className.paired = pair, scheduleViewTransitionEvent(deletion, props.onShare)) : restoreViewTransitionOnHostInstances(deletion.child, false));
                      pairs.delete(name);
                      if (0 === pairs.size) break;
                    }
                  }
                }
                commitDeletedPairViewTransitions(deletion);
              }
              deletion = deletion.sibling;
            }
        }
      }
      function commitExitViewTransitions(deletion) {
        if (30 === deletion.tag) {
          var props = deletion.memoizedProps, name = getViewTransitionName(props, deletion.stateNode), pair = null !== appearingViewTransitions ? appearingViewTransitions.get(name) : void 0, className = getViewTransitionClassName(
            props.default,
            void 0 !== pair ? props.share : props.exit
          );
          "none" !== className && (applyViewTransitionToHostInstances(deletion, name, className, null, false) ? void 0 !== pair ? (className = deletion.stateNode, pair.paired = className, className.paired = pair, appearingViewTransitions.delete(name), scheduleViewTransitionEvent(deletion, props.onShare)) : scheduleViewTransitionEvent(deletion, props.onExit) : restoreViewTransitionOnHostInstances(deletion.child, false));
          null !== appearingViewTransitions && commitDeletedPairViewTransitions(deletion);
        } else if (0 !== (deletion.subtreeFlags & 33554432))
          for (deletion = deletion.child; null !== deletion; )
            commitExitViewTransitions(deletion), deletion = deletion.sibling;
        else
          null !== appearingViewTransitions && commitDeletedPairViewTransitions(deletion);
      }
      function commitNestedViewTransitions(changedParent) {
        for (changedParent = changedParent.child; null !== changedParent; ) {
          if (30 === changedParent.tag) {
            var props = changedParent.memoizedProps, name = getViewTransitionName(props, changedParent.stateNode);
            props = getViewTransitionClassName(props.default, props.update);
            changedParent.flags &= -5;
            "none" !== props && applyViewTransitionToHostInstances(
              changedParent,
              name,
              props,
              changedParent.memoizedState = [],
              false
            );
          } else
            0 !== (changedParent.subtreeFlags & 33554432) && commitNestedViewTransitions(changedParent);
          changedParent = changedParent.sibling;
        }
      }
      function restorePairedViewTransitions(parent) {
        if (0 !== (parent.subtreeFlags & 18874368))
          for (parent = parent.child; null !== parent; ) {
            if (22 !== parent.tag || null === parent.memoizedState) {
              if (30 === parent.tag && 0 !== (parent.flags & 18874368)) {
                var instance = parent.stateNode;
                null !== instance.paired && (instance.paired = null, restoreViewTransitionOnHostInstances(parent.child, false));
              }
              restorePairedViewTransitions(parent);
            }
            parent = parent.sibling;
          }
      }
      function restoreEnterOrExitViewTransitions(fiber) {
        if (30 === fiber.tag)
          fiber.stateNode.paired = null, restoreViewTransitionOnHostInstances(fiber.child, false), restorePairedViewTransitions(fiber);
        else if (0 !== (fiber.subtreeFlags & 33554432))
          for (fiber = fiber.child; null !== fiber; )
            restoreEnterOrExitViewTransitions(fiber), fiber = fiber.sibling;
        else restorePairedViewTransitions(fiber);
      }
      function restoreNestedViewTransitions(changedParent) {
        for (changedParent = changedParent.child; null !== changedParent; )
          30 === changedParent.tag ? restoreViewTransitionOnHostInstances(changedParent.child, false) : 0 !== (changedParent.subtreeFlags & 33554432) && restoreNestedViewTransitions(changedParent), changedParent = changedParent.sibling;
      }
      function measureViewTransitionHostInstancesRecursive(parentViewTransition, child, newName, oldName, className, previousMeasurements, stopAtNestedViewTransitions) {
        for (var inViewport = false; null !== child; ) {
          if (5 === child.tag) {
            var instance = child.stateNode;
            if (null !== previousMeasurements && viewTransitionHostInstanceIdx < previousMeasurements.length) {
              var previousMeasurement = previousMeasurements[viewTransitionHostInstanceIdx], nextMeasurement = measureInstance(instance);
              if (previousMeasurement.view || nextMeasurement.view) inViewport = true;
              var JSCompiler_temp;
              if (JSCompiler_temp = 0 === (parentViewTransition.flags & 4))
                if (nextMeasurement.clip) JSCompiler_temp = true;
                else {
                  JSCompiler_temp = previousMeasurement.rect;
                  var newRect = nextMeasurement.rect;
                  JSCompiler_temp = JSCompiler_temp.y !== newRect.y || JSCompiler_temp.x !== newRect.x || JSCompiler_temp.height !== newRect.height || JSCompiler_temp.width !== newRect.width;
                }
              JSCompiler_temp && (parentViewTransition.flags |= 4);
              nextMeasurement.abs ? nextMeasurement = !previousMeasurement.abs : (previousMeasurement = previousMeasurement.rect, nextMeasurement = nextMeasurement.rect, nextMeasurement = previousMeasurement.height !== nextMeasurement.height || previousMeasurement.width !== nextMeasurement.width);
              nextMeasurement && (parentViewTransition.flags |= 32);
            } else parentViewTransition.flags |= 32;
            0 !== (parentViewTransition.flags & 4) && applyViewTransitionName(
              instance,
              0 === viewTransitionHostInstanceIdx ? newName : newName + "_" + viewTransitionHostInstanceIdx,
              className
            );
            inViewport && 0 !== (parentViewTransition.flags & 4) || (null === viewTransitionCancelableChildren && (viewTransitionCancelableChildren = []), viewTransitionCancelableChildren.push(
              instance,
              0 === viewTransitionHostInstanceIdx ? oldName : oldName + "_" + viewTransitionHostInstanceIdx,
              child.memoizedProps
            ));
            viewTransitionHostInstanceIdx++;
          } else if (22 !== child.tag || null === child.memoizedState)
            30 === child.tag && stopAtNestedViewTransitions ? parentViewTransition.flags |= child.flags & 32 : measureViewTransitionHostInstancesRecursive(
              parentViewTransition,
              child.child,
              newName,
              oldName,
              className,
              previousMeasurements,
              stopAtNestedViewTransitions
            ) && (inViewport = true);
          child = child.sibling;
        }
        return inViewport;
      }
      function measureNestedViewTransitions(changedParent, gesture) {
        for (changedParent = changedParent.child; null !== changedParent; ) {
          if (30 === changedParent.tag) {
            var props = changedParent.memoizedProps, state = changedParent.stateNode, name = getViewTransitionName(props, state), className = getViewTransitionClassName(props.default, props.update);
            if (gesture) {
              state = state.clones;
              var previousMeasurements = null === state ? null : state.map(measureClonedInstance);
            } else
              previousMeasurements = changedParent.memoizedState, changedParent.memoizedState = null;
            state = changedParent;
            var child = changedParent.child;
            viewTransitionHostInstanceIdx = 0;
            name = measureViewTransitionHostInstancesRecursive(
              state,
              child,
              name,
              name,
              className,
              previousMeasurements,
              false
            );
            0 !== (changedParent.flags & 4) && name && (gesture || scheduleViewTransitionEvent(changedParent, props.onUpdate));
          } else
            0 !== (changedParent.subtreeFlags & 33554432) && measureNestedViewTransitions(changedParent, gesture);
          changedParent = changedParent.sibling;
        }
      }
      var offscreenSubtreeIsHidden = false;
      var offscreenSubtreeWasHidden = false;
      var offscreenDirectParentIsHidden = false;
      var needsFormReset = false;
      var PossiblyWeakSet = "function" === typeof WeakSet ? WeakSet : Set;
      var nextEffect = null;
      var viewTransitionContextChanged = false;
      var inUpdateViewTransition = false;
      var rootViewTransitionAffected = false;
      var rootViewTransitionNameCanceled = false;
      function commitBeforeMutationEffects(root2, firstChild, committedLanes) {
        root2 = root2.containerInfo;
        eventsEnabled = _enabled;
        root2 = getActiveElementDeep(root2);
        if (hasSelectionCapabilities(root2)) {
          if ("selectionStart" in root2)
            var JSCompiler_temp = {
              start: root2.selectionStart,
              end: root2.selectionEnd
            };
          else
            a: {
              JSCompiler_temp = (JSCompiler_temp = root2.ownerDocument) && JSCompiler_temp.defaultView || window;
              var selection = JSCompiler_temp.getSelection && JSCompiler_temp.getSelection();
              if (selection && 0 !== selection.rangeCount) {
                JSCompiler_temp = selection.anchorNode;
                var anchorOffset = selection.anchorOffset, focusNode = selection.focusNode;
                selection = selection.focusOffset;
                try {
                  JSCompiler_temp.nodeType, focusNode.nodeType;
                } catch (e$21) {
                  JSCompiler_temp = null;
                  break a;
                }
                var length = 0, start = -1, end = -1, indexWithinAnchor = 0, indexWithinFocus = 0, node = root2, parentNode = null;
                b: for (; ; ) {
                  for (var next; ; ) {
                    node !== JSCompiler_temp || 0 !== anchorOffset && 3 !== node.nodeType || (start = length + anchorOffset);
                    node !== focusNode || 0 !== selection && 3 !== node.nodeType || (end = length + selection);
                    3 === node.nodeType && (length += node.nodeValue.length);
                    if (null === (next = node.firstChild)) break;
                    parentNode = node;
                    node = next;
                  }
                  for (; ; ) {
                    if (node === root2) break b;
                    parentNode === JSCompiler_temp && ++indexWithinAnchor === anchorOffset && (start = length);
                    parentNode === focusNode && ++indexWithinFocus === selection && (end = length);
                    if (null !== (next = node.nextSibling)) break;
                    node = parentNode;
                    parentNode = node.parentNode;
                  }
                  node = next;
                }
                JSCompiler_temp = -1 === start || -1 === end ? null : { start, end };
              } else JSCompiler_temp = null;
            }
          JSCompiler_temp = JSCompiler_temp || { start: 0, end: 0 };
        } else JSCompiler_temp = null;
        selectionInformation = { focusedElem: root2, selectionRange: JSCompiler_temp };
        _enabled = false;
        committedLanes = (committedLanes & 335544064) === committedLanes;
        nextEffect = firstChild;
        for (firstChild = committedLanes ? 9270 : 1024; null !== nextEffect; ) {
          root2 = nextEffect;
          if (committedLanes && (JSCompiler_temp = root2.deletions, null !== JSCompiler_temp))
            for (anchorOffset = 0; anchorOffset < JSCompiler_temp.length; anchorOffset++)
              committedLanes && commitExitViewTransitions(JSCompiler_temp[anchorOffset]);
          if (null === root2.alternate && 0 !== (root2.flags & 2))
            committedLanes && trackEnterViewTransitions(root2), commitBeforeMutationEffects_complete(committedLanes);
          else {
            if (22 === root2.tag) {
              if (JSCompiler_temp = root2.alternate, null !== root2.memoizedState) {
                null !== JSCompiler_temp && null === JSCompiler_temp.memoizedState && committedLanes && commitExitViewTransitions(JSCompiler_temp);
                commitBeforeMutationEffects_complete(committedLanes);
                continue;
              } else if (null !== JSCompiler_temp && null !== JSCompiler_temp.memoizedState) {
                committedLanes && trackEnterViewTransitions(root2);
                commitBeforeMutationEffects_complete(committedLanes);
                continue;
              }
            }
            JSCompiler_temp = root2.child;
            0 !== (root2.subtreeFlags & firstChild) && null !== JSCompiler_temp ? (JSCompiler_temp.return = root2, nextEffect = JSCompiler_temp) : (committedLanes && commitNestedViewTransitions(root2), commitBeforeMutationEffects_complete(committedLanes));
          }
        }
        appearingViewTransitions = null;
      }
      function commitBeforeMutationEffects_complete(isViewTransitionEligible$jscomp$0) {
        for (; null !== nextEffect; ) {
          var fiber = nextEffect, isViewTransitionEligible = isViewTransitionEligible$jscomp$0, current = fiber.alternate, flags = fiber.flags;
          switch (fiber.tag) {
            case 0:
            case 11:
            case 15:
              break;
            case 1:
              if (0 !== (flags & 1024) && null !== current) {
                isViewTransitionEligible = void 0;
                flags = current.memoizedProps;
                current = current.memoizedState;
                var instance = fiber.stateNode;
                try {
                  var resolvedPrevProps = resolveClassComponentProps(
                    fiber.type,
                    flags
                  );
                  isViewTransitionEligible = instance.getSnapshotBeforeUpdate(
                    resolvedPrevProps,
                    current
                  );
                  instance.__reactInternalSnapshotBeforeUpdate = isViewTransitionEligible;
                } catch (error) {
                  captureCommitPhaseError(fiber, fiber.return, error);
                }
              }
              break;
            case 3:
              if (0 !== (flags & 1024)) {
                if (current = fiber.stateNode.containerInfo, isViewTransitionEligible = current.nodeType, 9 === isViewTransitionEligible)
                  clearContainerSparingly(current);
                else if (1 === isViewTransitionEligible)
                  switch (current.nodeName) {
                    case "HEAD":
                    case "HTML":
                    case "BODY":
                      clearContainerSparingly(current);
                      break;
                    default:
                      current.textContent = "";
                  }
              }
              break;
            case 5:
            case 26:
            case 27:
            case 6:
            case 4:
            case 17:
              break;
            case 30:
              isViewTransitionEligible && null !== current && (isViewTransitionEligible = getViewTransitionName(
                current.memoizedProps,
                current.stateNode
              ), flags = fiber.memoizedProps, flags = getViewTransitionClassName(flags.default, flags.update), "none" !== flags && applyViewTransitionToHostInstances(
                current,
                isViewTransitionEligible,
                flags,
                current.memoizedState = [],
                true
              ));
              break;
            default:
              if (0 !== (flags & 1024)) throw Error(formatProdErrorMessage(163));
          }
          current = fiber.sibling;
          if (null !== current) {
            current.return = fiber.return;
            nextEffect = current;
            break;
          }
          nextEffect = fiber.return;
        }
      }
      function commitLayoutEffectOnFiber(finishedRoot, current, finishedWork) {
        var flags = finishedWork.flags;
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 15:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            flags & 4 && commitHookEffectListMount(5, finishedWork);
            break;
          case 1:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            if (flags & 4)
              if (finishedRoot = finishedWork.stateNode, null === current)
                try {
                  finishedRoot.componentDidMount();
                } catch (error) {
                  captureCommitPhaseError(finishedWork, finishedWork.return, error);
                }
              else {
                var prevProps = resolveClassComponentProps(
                  finishedWork.type,
                  current.memoizedProps
                );
                current = current.memoizedState;
                try {
                  finishedRoot.componentDidUpdate(
                    prevProps,
                    current,
                    finishedRoot.__reactInternalSnapshotBeforeUpdate
                  );
                } catch (error$146) {
                  captureCommitPhaseError(
                    finishedWork,
                    finishedWork.return,
                    error$146
                  );
                }
              }
            flags & 64 && commitClassCallbacks(finishedWork);
            flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
            break;
          case 3:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            if (flags & 64 && (finishedRoot = finishedWork.updateQueue, null !== finishedRoot)) {
              current = null;
              if (null !== finishedWork.child)
                switch (finishedWork.child.tag) {
                  case 27:
                  case 5:
                    current = finishedWork.child.stateNode;
                    break;
                  case 1:
                    current = finishedWork.child.stateNode;
                }
              try {
                commitCallbacks(finishedRoot, current);
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            }
            break;
          case 27:
            null === current && flags & 4 && commitHostSingletonAcquisition(finishedWork);
          case 26:
          case 5:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            null === current && flags & 4 && commitHostMount(finishedWork);
            flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
            break;
          case 12:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            break;
          case 31:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            flags & 4 && commitActivityHydrationCallbacks(finishedRoot, finishedWork);
            break;
          case 13:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            flags & 4 && commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
            flags & 64 && (finishedRoot = finishedWork.memoizedState, null !== finishedRoot && (finishedRoot = finishedRoot.dehydrated, null !== finishedRoot && (finishedWork = retryDehydratedSuspenseBoundary.bind(
              null,
              finishedWork
            ), registerSuspenseInstanceRetry(finishedRoot, finishedWork))));
            break;
          case 22:
            flags = null !== finishedWork.memoizedState || offscreenSubtreeIsHidden;
            if (!flags) {
              var newOffscreenSubtreeWasHidden = null !== current && null !== current.memoizedState || offscreenSubtreeWasHidden;
              current = offscreenSubtreeIsHidden;
              prevProps = offscreenSubtreeWasHidden;
              offscreenSubtreeIsHidden = flags;
              (offscreenSubtreeWasHidden = newOffscreenSubtreeWasHidden) && !prevProps ? (flags = 2, 0 !== (finishedWork.subtreeFlags & 8772) && (flags |= 1), recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                flags
              )) : recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
              offscreenSubtreeIsHidden = current;
              offscreenSubtreeWasHidden = prevProps;
            }
            break;
          case 30:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
            break;
          case 7:
            flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
          default:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
        }
      }
      function hideOrUnhideAllChildren(parentFiber, isHidden) {
        for (parentFiber = parentFiber.child; null !== parentFiber; )
          hideOrUnhideAllChildrenOnFiber(parentFiber, isHidden), parentFiber = parentFiber.sibling;
      }
      function hideOrUnhideAllChildrenOnFiber(fiber, isHidden) {
        switch (fiber.tag) {
          case 5:
          case 26:
            try {
              var instance = fiber.stateNode;
              if (isHidden) {
                var style2 = instance.style;
                "function" === typeof style2.setProperty ? style2.setProperty("display", "none", "important") : style2.display = "none";
              } else {
                var instance$jscomp$0 = fiber.stateNode, styleProp = fiber.memoizedProps.style, display = void 0 !== styleProp && null !== styleProp && styleProp.hasOwnProperty("display") ? styleProp.display : null;
                instance$jscomp$0.style.display = null == display || "boolean" === typeof display ? "" : ("" + display).trim();
              }
            } catch (error) {
              captureCommitPhaseError(fiber, fiber.return, error);
            }
            hideOrUnhideNearestPortals(fiber, isHidden);
            break;
          case 6:
            try {
              fiber.stateNode.nodeValue = isHidden ? "" : fiber.memoizedProps, viewTransitionMutationContext = true;
            } catch (error) {
              captureCommitPhaseError(fiber, fiber.return, error);
            }
            break;
          case 18:
            try {
              var instance$jscomp$1 = fiber.stateNode;
              isHidden ? hideOrUnhideDehydratedBoundary(instance$jscomp$1, true) : hideOrUnhideDehydratedBoundary(fiber.stateNode, false);
            } catch (error) {
              captureCommitPhaseError(fiber, fiber.return, error);
            }
            break;
          case 22:
          case 23:
            null === fiber.memoizedState && hideOrUnhideAllChildren(fiber, isHidden);
            break;
          default:
            hideOrUnhideAllChildren(fiber, isHidden);
        }
      }
      function hideOrUnhideNearestPortals(parentFiber, isHidden$jscomp$0) {
        if (parentFiber.subtreeFlags & 67108864)
          for (parentFiber = parentFiber.child; null !== parentFiber; ) {
            a: {
              var fiber = parentFiber, isHidden = isHidden$jscomp$0;
              switch (fiber.tag) {
                case 4:
                  hideOrUnhideAllChildrenOnFiber(fiber, isHidden);
                  break a;
                case 22:
                  null === fiber.memoizedState && hideOrUnhideNearestPortals(fiber, isHidden);
                  break a;
                default:
                  hideOrUnhideNearestPortals(fiber, isHidden);
              }
            }
            parentFiber = parentFiber.sibling;
          }
      }
      function detachFiberAfterEffects(fiber) {
        var alternate = fiber.alternate;
        null !== alternate && (fiber.alternate = null, detachFiberAfterEffects(alternate));
        fiber.child = null;
        fiber.deletions = null;
        fiber.sibling = null;
        5 === fiber.tag && (alternate = fiber.stateNode, null !== alternate && detachDeletedInstance(alternate));
        fiber.stateNode = null;
        fiber.return = null;
        fiber.dependencies = null;
        fiber.memoizedProps = null;
        fiber.memoizedState = null;
        fiber.pendingProps = null;
        fiber.stateNode = null;
        fiber.updateQueue = null;
      }
      var hostParent = null;
      var hostParentIsContainer = false;
      function recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, parent) {
        for (parent = parent.child; null !== parent; )
          commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, parent), parent = parent.sibling;
      }
      function commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, deletedFiber) {
        if (injectedHook && "function" === typeof injectedHook.onCommitFiberUnmount)
          try {
            injectedHook.onCommitFiberUnmount(rendererID, deletedFiber);
          } catch (err) {
          }
        switch (deletedFiber.tag) {
          case 26:
            offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            deletedFiber.memoizedState ? deletedFiber.memoizedState.count-- : deletedFiber.stateNode && !offscreenSubtreeWasHidden && (deletedFiber = deletedFiber.stateNode, deletedFiber.parentNode.removeChild(deletedFiber));
            break;
          case 27:
            offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
            commitFragmentInstanceDeletionEffects(deletedFiber);
            var prevHostParent = hostParent, prevHostParentIsContainer = hostParentIsContainer;
            isSingletonScope(deletedFiber.type) && (hostParent = deletedFiber.stateNode, hostParentIsContainer = false);
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            releaseSingletonInstance(
              deletedFiber.stateNode,
              deletedFiber.type,
              deletedFiber.memoizedProps
            );
            hostParent = prevHostParent;
            hostParentIsContainer = prevHostParentIsContainer;
            break;
          case 5:
            offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor), commitFragmentInstanceDeletionEffects(deletedFiber);
          case 6:
            6 === deletedFiber.tag && commitFragmentInstanceDeletionEffects(deletedFiber);
            prevHostParent = hostParent;
            prevHostParentIsContainer = hostParentIsContainer;
            hostParent = null;
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            hostParent = prevHostParent;
            hostParentIsContainer = prevHostParentIsContainer;
            if (null !== hostParent)
              if (hostParentIsContainer)
                try {
                  (9 === hostParent.nodeType ? hostParent.body : "HTML" === hostParent.nodeName ? hostParent.ownerDocument.body : hostParent).removeChild(deletedFiber.stateNode), viewTransitionMutationContext = true;
                } catch (error) {
                  captureCommitPhaseError(
                    deletedFiber,
                    nearestMountedAncestor,
                    error
                  );
                }
              else
                try {
                  hostParent.removeChild(deletedFiber.stateNode), viewTransitionMutationContext = true;
                } catch (error) {
                  captureCommitPhaseError(
                    deletedFiber,
                    nearestMountedAncestor,
                    error
                  );
                }
            break;
          case 18:
            null !== hostParent && (hostParentIsContainer ? (finishedRoot = hostParent, clearHydrationBoundary(
              9 === finishedRoot.nodeType ? finishedRoot.body : "HTML" === finishedRoot.nodeName ? finishedRoot.ownerDocument.body : finishedRoot,
              deletedFiber.stateNode
            ), retryIfBlockedOn(finishedRoot)) : clearHydrationBoundary(hostParent, deletedFiber.stateNode));
            break;
          case 4:
            prevHostParent = hostParent;
            prevHostParentIsContainer = hostParentIsContainer;
            hostParent = deletedFiber.stateNode.containerInfo;
            hostParentIsContainer = true;
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            hostParent = prevHostParent;
            hostParentIsContainer = prevHostParentIsContainer;
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            commitHookEffectListUnmount(2, deletedFiber, nearestMountedAncestor);
            offscreenSubtreeWasHidden || commitHookEffectListUnmount(4, deletedFiber, nearestMountedAncestor);
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            break;
          case 1:
            offscreenSubtreeWasHidden || (safelyDetachRef(deletedFiber, nearestMountedAncestor), prevHostParent = deletedFiber.stateNode, "function" === typeof prevHostParent.componentWillUnmount && safelyCallComponentWillUnmount(
              deletedFiber,
              nearestMountedAncestor,
              prevHostParent
            ));
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            break;
          case 21:
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            break;
          case 22:
            offscreenSubtreeWasHidden = (prevHostParent = offscreenSubtreeWasHidden) || null !== deletedFiber.memoizedState;
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            offscreenSubtreeWasHidden = prevHostParent;
            break;
          case 30:
            safelyDetachRef(deletedFiber, nearestMountedAncestor);
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            break;
          case 7:
            offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            break;
          default:
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
        }
      }
      function commitActivityHydrationCallbacks(finishedRoot, finishedWork) {
        if (null === finishedWork.memoizedState && (finishedRoot = finishedWork.alternate, null !== finishedRoot && (finishedRoot = finishedRoot.memoizedState, null !== finishedRoot))) {
          finishedRoot = finishedRoot.dehydrated;
          try {
            retryIfBlockedOn(finishedRoot);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
      }
      function commitSuspenseHydrationCallbacks(finishedRoot, finishedWork) {
        if (null === finishedWork.memoizedState && (finishedRoot = finishedWork.alternate, null !== finishedRoot && (finishedRoot = finishedRoot.memoizedState, null !== finishedRoot && (finishedRoot = finishedRoot.dehydrated, null !== finishedRoot))))
          try {
            retryIfBlockedOn(finishedRoot);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
      }
      function getRetryCache(finishedWork) {
        switch (finishedWork.tag) {
          case 31:
          case 13:
          case 19:
            var retryCache = finishedWork.stateNode;
            null === retryCache && (retryCache = finishedWork.stateNode = new PossiblyWeakSet());
            return retryCache;
          case 22:
            return finishedWork = finishedWork.stateNode, retryCache = finishedWork._retryCache, null === retryCache && (retryCache = finishedWork._retryCache = new PossiblyWeakSet()), retryCache;
          default:
            throw Error(formatProdErrorMessage(435, finishedWork.tag));
        }
      }
      function attachSuspenseRetryListeners(finishedWork, wakeables) {
        var retryCache = getRetryCache(finishedWork);
        wakeables.forEach(function(wakeable) {
          if (!retryCache.has(wakeable)) {
            retryCache.add(wakeable);
            var retry = resolveRetryWakeable.bind(null, finishedWork, wakeable);
            wakeable.then(retry, retry);
          }
        });
      }
      function recursivelyTraverseMutationEffects(root$jscomp$0, parentFiber, lanes) {
        var deletions = parentFiber.deletions;
        if (null !== deletions)
          for (var i = 0; i < deletions.length; i++) {
            var childToDelete = deletions[i], root2 = root$jscomp$0, returnFiber = parentFiber, parent = returnFiber;
            a: for (; null !== parent; ) {
              switch (parent.tag) {
                case 27:
                  if (isSingletonScope(parent.type)) {
                    hostParent = parent.stateNode;
                    hostParentIsContainer = false;
                    break a;
                  }
                  break;
                case 5:
                  hostParent = parent.stateNode;
                  hostParentIsContainer = false;
                  break a;
                case 3:
                case 4:
                  hostParent = parent.stateNode.containerInfo;
                  hostParentIsContainer = true;
                  break a;
              }
              parent = parent.return;
            }
            if (null === hostParent) throw Error(formatProdErrorMessage(160));
            commitDeletionEffectsOnFiber(root2, returnFiber, childToDelete);
            hostParent = null;
            hostParentIsContainer = false;
            root2 = childToDelete.alternate;
            null !== root2 && (root2.return = null);
            childToDelete.return = null;
          }
        if (parentFiber.subtreeFlags & 13886)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            commitMutationEffectsOnFiber(parentFiber, root$jscomp$0, lanes), parentFiber = parentFiber.sibling;
      }
      var currentHoistableRoot = null;
      function commitMutationEffectsOnFiber(finishedWork, root2, lanes) {
        var current = finishedWork.alternate, flags = finishedWork.flags;
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            if (flags & 4 && (current = finishedWork.updateQueue, current = null !== current ? current.events : null, null !== current))
              for (var ii = 0; ii < current.length; ii++) {
                var _eventPayloads$ii2 = current[ii];
                _eventPayloads$ii2.ref.impl = _eventPayloads$ii2.nextImpl;
              }
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes);
            commitReconciliationEffects(finishedWork);
            flags & 4 && (commitHookEffectListUnmount(3, finishedWork, finishedWork.return), commitHookEffectListMount(3, finishedWork), commitHookEffectListUnmount(5, finishedWork, finishedWork.return));
            break;
          case 1:
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes);
            commitReconciliationEffects(finishedWork);
            flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
            flags & 64 && offscreenSubtreeIsHidden && (finishedWork = finishedWork.updateQueue, null !== finishedWork && (root2 = finishedWork.callbacks, null !== root2 && (lanes = finishedWork.shared.hiddenCallbacks, finishedWork.shared.hiddenCallbacks = null === lanes ? root2 : lanes.concat(root2))));
            break;
          case 26:
            ii = currentHoistableRoot;
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes);
            commitReconciliationEffects(finishedWork);
            flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
            if (flags & 4)
              if (flags = null !== current ? current.memoizedState : null, lanes = finishedWork.memoizedState, null === current)
                if (null === lanes)
                  if (null === finishedWork.stateNode)
                    if (offscreenSubtreeIsHidden)
                      finishedWork.stateNode = createHoistableInstance(
                        finishedWork.type,
                        finishedWork.memoizedProps,
                        root2.containerInfo,
                        finishedWork
                      );
                    else {
                      a: {
                        root2 = finishedWork.type;
                        lanes = finishedWork.memoizedProps;
                        flags = ii.ownerDocument || ii;
                        b: switch (root2) {
                          case "title":
                            current = flags.getElementsByTagName("title")[0];
                            if (!current || current[internalHoistableMarker] || current[internalInstanceKey] || "http://www.w3.org/2000/svg" === current.namespaceURI || current.hasAttribute("itemprop"))
                              current = flags.createElement(root2), flags.head.insertBefore(
                                current,
                                flags.querySelector("head > title")
                              );
                            setInitialProperties(current, root2, lanes);
                            current[internalInstanceKey] = finishedWork;
                            markNodeAsHoistable(current);
                            root2 = current;
                            break a;
                          case "link":
                            if (ii = getHydratableHoistableCache(
                              "link",
                              "href",
                              flags
                            ).get(root2 + (lanes.href || ""))) {
                              for (_eventPayloads$ii2 = 0; _eventPayloads$ii2 < ii.length; _eventPayloads$ii2++)
                                if (current = ii[_eventPayloads$ii2], current.getAttribute("href") === (null == lanes.href || "" === lanes.href ? null : lanes.href) && current.getAttribute("rel") === (null == lanes.rel ? null : lanes.rel) && current.getAttribute("title") === (null == lanes.title ? null : lanes.title) && current.getAttribute("crossorigin") === (null == lanes.crossOrigin ? null : lanes.crossOrigin)) {
                                  ii.splice(_eventPayloads$ii2, 1);
                                  break b;
                                }
                            }
                            current = flags.createElement(root2);
                            setInitialProperties(current, root2, lanes);
                            flags.head.appendChild(current);
                            break;
                          case "meta":
                            if (ii = getHydratableHoistableCache(
                              "meta",
                              "content",
                              flags
                            ).get(root2 + (lanes.content || ""))) {
                              for (_eventPayloads$ii2 = 0; _eventPayloads$ii2 < ii.length; _eventPayloads$ii2++)
                                if (current = ii[_eventPayloads$ii2], current.getAttribute("content") === (null == lanes.content ? null : "" + lanes.content) && current.getAttribute("name") === (null == lanes.name ? null : lanes.name) && current.getAttribute("property") === (null == lanes.property ? null : lanes.property) && current.getAttribute("http-equiv") === (null == lanes.httpEquiv ? null : lanes.httpEquiv) && current.getAttribute("charset") === (null == lanes.charSet ? null : lanes.charSet)) {
                                  ii.splice(_eventPayloads$ii2, 1);
                                  break b;
                                }
                            }
                            current = flags.createElement(root2);
                            setInitialProperties(current, root2, lanes);
                            flags.head.appendChild(current);
                            break;
                          default:
                            throw Error(formatProdErrorMessage(468, root2));
                        }
                        current[internalInstanceKey] = finishedWork;
                        markNodeAsHoistable(current);
                        root2 = current;
                      }
                      finishedWork.stateNode = root2;
                    }
                  else
                    offscreenSubtreeIsHidden || mountHoistable(ii, finishedWork.type, finishedWork.stateNode);
                else
                  finishedWork.stateNode = acquireResource(
                    ii,
                    lanes,
                    finishedWork.memoizedProps
                  );
              else
                flags !== lanes ? (null === flags ? (root2 = current.stateNode, null === root2 || offscreenSubtreeWasHidden || root2.parentNode.removeChild(root2)) : flags.count--, null === lanes ? offscreenSubtreeIsHidden || mountHoistable(ii, finishedWork.type, finishedWork.stateNode) : acquireResource(ii, lanes, finishedWork.memoizedProps)) : null === lanes && null !== finishedWork.stateNode && commitHostUpdate(
                  finishedWork,
                  finishedWork.memoizedProps,
                  current.memoizedProps
                );
            break;
          case 27:
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes);
            commitReconciliationEffects(finishedWork);
            flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
            null !== current && flags & 4 && commitHostUpdate(
              finishedWork,
              finishedWork.memoizedProps,
              current.memoizedProps
            );
            break;
          case 5:
            ii = offscreenDirectParentIsHidden;
            offscreenDirectParentIsHidden = false;
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes);
            offscreenDirectParentIsHidden = ii;
            commitReconciliationEffects(finishedWork);
            flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
            if (finishedWork.flags & 32) {
              root2 = finishedWork.stateNode;
              try {
                setTextContent(root2, ""), viewTransitionMutationContext = true;
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            }
            flags & 4 && null != finishedWork.stateNode && (root2 = finishedWork.memoizedProps, commitHostUpdate(
              finishedWork,
              root2,
              null !== current ? current.memoizedProps : root2
            ));
            flags & 1024 && (needsFormReset = true);
            break;
          case 6:
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes);
            commitReconciliationEffects(finishedWork);
            if (flags & 4) {
              if (null === finishedWork.stateNode)
                throw Error(formatProdErrorMessage(162));
              root2 = finishedWork.memoizedProps;
              lanes = finishedWork.stateNode;
              try {
                lanes.nodeValue = root2, viewTransitionMutationContext = true;
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            }
            break;
          case 3:
            viewTransitionMutationContext = false;
            tagCaches = null;
            ii = currentHoistableRoot;
            currentHoistableRoot = getHoistableRoot(root2.containerInfo);
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes);
            currentHoistableRoot = ii;
            commitReconciliationEffects(finishedWork);
            if (flags & 4 && null !== current && current.memoizedState.isDehydrated)
              try {
                retryIfBlockedOn(root2.containerInfo);
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            needsFormReset && (needsFormReset = false, recursivelyResetForms(finishedWork));
            viewTransitionMutationContext = false;
            break;
          case 4:
            flags = offscreenDirectParentIsHidden;
            offscreenDirectParentIsHidden = offscreenSubtreeIsHidden;
            current = pushMutationContext();
            ii = currentHoistableRoot;
            currentHoistableRoot = getHoistableRoot(
              finishedWork.stateNode.containerInfo
            );
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes);
            commitReconciliationEffects(finishedWork);
            currentHoistableRoot = ii;
            viewTransitionMutationContext && inUpdateViewTransition && (rootViewTransitionAffected = true);
            viewTransitionMutationContext = current;
            offscreenDirectParentIsHidden = flags;
            break;
          case 12:
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes);
            commitReconciliationEffects(finishedWork);
            break;
          case 31:
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes);
            commitReconciliationEffects(finishedWork);
            flags & 4 && (root2 = finishedWork.updateQueue, null !== root2 && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, root2)));
            break;
          case 13:
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes);
            commitReconciliationEffects(finishedWork);
            finishedWork.child.flags & 8192 && null !== finishedWork.memoizedState !== (null !== current && null !== current.memoizedState) && (globalMostRecentFallbackTime = now());
            flags & 4 && (root2 = finishedWork.updateQueue, null !== root2 && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, root2)));
            break;
          case 22:
            ii = null !== finishedWork.memoizedState;
            _eventPayloads$ii2 = null !== current && null !== current.memoizedState;
            var prevOffscreenSubtreeIsHidden = offscreenSubtreeIsHidden, prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden, prevOffscreenDirectParentIsHidden$166 = offscreenDirectParentIsHidden;
            offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden || ii;
            offscreenDirectParentIsHidden = prevOffscreenDirectParentIsHidden$166 || ii;
            offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden || _eventPayloads$ii2;
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes);
            offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
            offscreenDirectParentIsHidden = prevOffscreenDirectParentIsHidden$166;
            offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden;
            commitReconciliationEffects(finishedWork);
            flags & 8192 && (root2 = finishedWork.stateNode, root2._visibility = ii ? root2._visibility & -2 : root2._visibility | 1, !ii || null === current || _eventPayloads$ii2 || offscreenSubtreeIsHidden || offscreenSubtreeWasHidden || (root2 = _eventPayloads$ii2 || offscreenSubtreeWasHidden, lanes = offscreenSubtreeIsHidden, current = offscreenSubtreeWasHidden, offscreenSubtreeIsHidden = ii || offscreenSubtreeIsHidden, offscreenSubtreeWasHidden = root2, recursivelyTraverseDisappearLayoutEffects(finishedWork, 2), offscreenSubtreeIsHidden = lanes, offscreenSubtreeWasHidden = current), !ii && offscreenDirectParentIsHidden || hideOrUnhideAllChildren(finishedWork, ii));
            flags & 4 && (root2 = finishedWork.updateQueue, null !== root2 && (lanes = root2.retryQueue, null !== lanes && (root2.retryQueue = null, attachSuspenseRetryListeners(finishedWork, lanes))));
            break;
          case 19:
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes);
            commitReconciliationEffects(finishedWork);
            flags & 4 && (root2 = finishedWork.updateQueue, null !== root2 && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, root2)));
            break;
          case 30:
            flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
            flags = pushMutationContext();
            ii = inUpdateViewTransition;
            _eventPayloads$ii2 = (lanes & 335544064) === lanes;
            prevOffscreenSubtreeIsHidden = finishedWork.memoizedProps;
            inUpdateViewTransition = _eventPayloads$ii2 && "none" !== getViewTransitionClassName(
              prevOffscreenSubtreeIsHidden.default,
              prevOffscreenSubtreeIsHidden.update
            );
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes);
            commitReconciliationEffects(finishedWork);
            _eventPayloads$ii2 && null !== current && viewTransitionMutationContext && (finishedWork.flags |= 4);
            inUpdateViewTransition = ii;
            viewTransitionMutationContext = flags;
            break;
          case 21:
            break;
          case 7:
            flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return)), current && null !== current.stateNode && (current.stateNode._fragmentFiber = finishedWork);
          default:
            recursivelyTraverseMutationEffects(root2, finishedWork, lanes), commitReconciliationEffects(finishedWork);
        }
      }
      function commitReconciliationEffects(finishedWork) {
        var flags = finishedWork.flags;
        if (flags & 2) {
          try {
            for (var hostParentFiber, parentFiber = finishedWork.return; null !== parentFiber; ) {
              if (isHostParent(parentFiber)) {
                hostParentFiber = parentFiber;
                break;
              }
              parentFiber = parentFiber.return;
            }
            parentFiber = null;
            for (var parent = finishedWork.return; null !== parent; ) {
              if (isFragmentInstanceParent(parent)) {
                var fragmentInstance = parent.stateNode;
                null === parentFiber ? parentFiber = [fragmentInstance] : parentFiber.push(fragmentInstance);
              }
              if (isFragmentInstanceHostBoundary(parent)) break;
              parent = parent.return;
            }
            var JSCompiler_inline_result = parentFiber;
            if (null == hostParentFiber) throw Error(formatProdErrorMessage(160));
            switch (hostParentFiber.tag) {
              case 27:
                var parent$jscomp$0 = hostParentFiber.stateNode, before = getHostSibling(finishedWork);
                insertOrAppendPlacementNode(
                  finishedWork,
                  before,
                  parent$jscomp$0,
                  JSCompiler_inline_result
                );
                break;
              case 5:
                var parent$149 = hostParentFiber.stateNode;
                hostParentFiber.flags & 32 && (setTextContent(parent$149, ""), hostParentFiber.flags &= -33);
                var before$150 = getHostSibling(finishedWork);
                insertOrAppendPlacementNode(
                  finishedWork,
                  before$150,
                  parent$149,
                  JSCompiler_inline_result
                );
                break;
              case 3:
              case 4:
                var parent$151 = hostParentFiber.stateNode.containerInfo, before$152 = getHostSibling(finishedWork);
                insertOrAppendPlacementNodeIntoContainer(
                  finishedWork,
                  before$152,
                  parent$151,
                  JSCompiler_inline_result
                );
                break;
              default:
                throw Error(formatProdErrorMessage(161));
            }
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
          finishedWork.flags &= -3;
        }
        flags & 4096 && (finishedWork.flags &= -4097);
      }
      function recursivelyResetForms(parentFiber) {
        if (parentFiber.subtreeFlags & 1024)
          for (parentFiber = parentFiber.child; null !== parentFiber; ) {
            var fiber = parentFiber;
            recursivelyResetForms(fiber);
            5 === fiber.tag && fiber.flags & 1024 && (fiber = fiber.stateNode, _enabled = true, fiber.reset(), _enabled = false);
            parentFiber = parentFiber.sibling;
          }
      }
      function recursivelyTraverseAfterMutationEffects(root2, parentFiber) {
        if (parentFiber.subtreeFlags & 9270)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            commitAfterMutationEffectsOnFiber(parentFiber, root2), parentFiber = parentFiber.sibling;
        else measureNestedViewTransitions(parentFiber, false);
      }
      function commitAfterMutationEffectsOnFiber(finishedWork, root2) {
        var current = finishedWork.alternate;
        if (null === current) commitEnterViewTransitions(finishedWork, false);
        else
          switch (finishedWork.tag) {
            case 3:
              rootViewTransitionNameCanceled = viewTransitionContextChanged = false;
              pushViewTransitionCancelableScope();
              recursivelyTraverseAfterMutationEffects(root2, finishedWork);
              if (!viewTransitionContextChanged && !rootViewTransitionAffected) {
                finishedWork = viewTransitionCancelableChildren;
                if (null !== finishedWork)
                  for (var i = 0; i < finishedWork.length; i += 3) {
                    current = finishedWork[i];
                    var oldName = finishedWork[i + 1];
                    restoreViewTransitionName(current, finishedWork[i + 2]);
                    current = current.ownerDocument.documentElement;
                    null !== current && current.animate(
                      { opacity: [0, 0], pointerEvents: ["none", "none"] },
                      {
                        duration: 0,
                        fill: "forwards",
                        pseudoElement: "::view-transition-group(" + oldName + ")"
                      }
                    );
                  }
                finishedWork = root2.containerInfo;
                finishedWork = 9 === finishedWork.nodeType ? finishedWork.documentElement : finishedWork.ownerDocument.documentElement;
                null !== finishedWork && "" === finishedWork.style.viewTransitionName && (finishedWork.style.viewTransitionName = "none", finishedWork.animate(
                  { opacity: [0, 0], pointerEvents: ["none", "none"] },
                  {
                    duration: 0,
                    fill: "forwards",
                    pseudoElement: "::view-transition-group(root)"
                  }
                ), finishedWork.animate(
                  { width: [0, 0], height: [0, 0] },
                  {
                    duration: 0,
                    fill: "forwards",
                    pseudoElement: "::view-transition"
                  }
                ));
                rootViewTransitionNameCanceled = true;
              }
              viewTransitionCancelableChildren = null;
              break;
            case 5:
              recursivelyTraverseAfterMutationEffects(root2, finishedWork);
              break;
            case 4:
              i = viewTransitionContextChanged;
              viewTransitionContextChanged = false;
              recursivelyTraverseAfterMutationEffects(root2, finishedWork);
              viewTransitionContextChanged && (rootViewTransitionAffected = true);
              viewTransitionContextChanged = i;
              break;
            case 22:
              null === finishedWork.memoizedState && (null !== current.memoizedState ? commitEnterViewTransitions(finishedWork, false) : recursivelyTraverseAfterMutationEffects(root2, finishedWork));
              break;
            case 30:
              i = viewTransitionContextChanged;
              oldName = pushViewTransitionCancelableScope();
              viewTransitionContextChanged = false;
              recursivelyTraverseAfterMutationEffects(root2, finishedWork);
              viewTransitionContextChanged && (finishedWork.flags |= 4);
              var props = finishedWork.memoizedProps, state = finishedWork.stateNode;
              root2 = getViewTransitionName(props, state);
              state = getViewTransitionName(current.memoizedProps, state);
              var className = getViewTransitionClassName(props.default, props.update);
              "none" === className ? root2 = false : (props = current.memoizedState, current.memoizedState = null, current = finishedWork.child, viewTransitionHostInstanceIdx = 0, root2 = measureViewTransitionHostInstancesRecursive(
                finishedWork,
                current,
                root2,
                state,
                className,
                props,
                true
              ), viewTransitionHostInstanceIdx !== (null === props ? 0 : props.length) && (finishedWork.flags |= 32));
              0 !== (finishedWork.flags & 4) && root2 ? (scheduleViewTransitionEvent(
                finishedWork,
                finishedWork.memoizedProps.onUpdate
              ), viewTransitionCancelableChildren = oldName) : null !== oldName && (oldName.push.apply(oldName, viewTransitionCancelableChildren), viewTransitionCancelableChildren = oldName);
              viewTransitionContextChanged = 0 !== (finishedWork.flags & 32) ? true : i;
              break;
            default:
              recursivelyTraverseAfterMutationEffects(root2, finishedWork);
          }
      }
      function recursivelyTraverseLayoutEffects(root2, parentFiber) {
        if (parentFiber.subtreeFlags & 8772)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            commitLayoutEffectOnFiber(root2, parentFiber.alternate, parentFiber), parentFiber = parentFiber.sibling;
      }
      function recursivelyTraverseDisappearLayoutEffects(parentFiber, layoutEffectTraversalFlags$jscomp$0) {
        for (parentFiber = parentFiber.child; null !== parentFiber; ) {
          var finishedWork = parentFiber, layoutEffectTraversalFlags = layoutEffectTraversalFlags$jscomp$0;
          switch (finishedWork.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              commitHookEffectListUnmount(4, finishedWork, finishedWork.return);
              recursivelyTraverseDisappearLayoutEffects(
                finishedWork,
                layoutEffectTraversalFlags
              );
              break;
            case 1:
              safelyDetachRef(finishedWork, finishedWork.return);
              var instance = finishedWork.stateNode;
              "function" === typeof instance.componentWillUnmount && safelyCallComponentWillUnmount(
                finishedWork,
                finishedWork.return,
                instance
              );
              recursivelyTraverseDisappearLayoutEffects(
                finishedWork,
                layoutEffectTraversalFlags
              );
              break;
            case 27:
              0 !== (layoutEffectTraversalFlags & 2) && releaseSingletonInstance(
                finishedWork.stateNode,
                finishedWork.type,
                finishedWork.memoizedProps
              );
            case 5:
              safelyDetachRef(finishedWork, finishedWork.return);
              5 !== finishedWork.tag && 27 !== finishedWork.tag || commitFragmentInstanceDeletionEffects(finishedWork);
              recursivelyTraverseDisappearLayoutEffects(
                finishedWork,
                layoutEffectTraversalFlags
              );
              break;
            case 6:
              commitFragmentInstanceDeletionEffects(finishedWork);
              break;
            case 26:
              safelyDetachRef(finishedWork, finishedWork.return);
              instance = finishedWork.stateNode;
              null !== finishedWork.memoizedState || null === instance || offscreenSubtreeWasHidden || instance.parentNode.removeChild(instance);
              recursivelyTraverseDisappearLayoutEffects(
                finishedWork,
                layoutEffectTraversalFlags
              );
              break;
            case 22:
              null === finishedWork.memoizedState && recursivelyTraverseDisappearLayoutEffects(
                finishedWork,
                layoutEffectTraversalFlags
              );
              break;
            case 30:
              safelyDetachRef(finishedWork, finishedWork.return);
              recursivelyTraverseDisappearLayoutEffects(
                finishedWork,
                layoutEffectTraversalFlags
              );
              break;
            case 7:
              safelyDetachRef(finishedWork, finishedWork.return);
            default:
              recursivelyTraverseDisappearLayoutEffects(
                finishedWork,
                layoutEffectTraversalFlags
              );
          }
          parentFiber = parentFiber.sibling;
        }
      }
      function recursivelyTraverseReappearLayoutEffects(finishedRoot$jscomp$0, parentFiber, layoutEffectTraversalFlags) {
        layoutEffectTraversalFlags = 0 !== (parentFiber.subtreeFlags & 8772) ? layoutEffectTraversalFlags : layoutEffectTraversalFlags & -2;
        for (parentFiber = parentFiber.child; null !== parentFiber; ) {
          var current = parentFiber.alternate, finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, flags = finishedWork.flags, includeWorkInProgressEffects = 0 !== (layoutEffectTraversalFlags & 1);
          switch (finishedWork.tag) {
            case 0:
            case 11:
            case 15:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                layoutEffectTraversalFlags
              );
              commitHookEffectListMount(4, finishedWork);
              break;
            case 1:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                layoutEffectTraversalFlags
              );
              current = finishedWork;
              finishedRoot = current.stateNode;
              if ("function" === typeof finishedRoot.componentDidMount)
                try {
                  finishedRoot.componentDidMount();
                } catch (error) {
                  captureCommitPhaseError(current, current.return, error);
                }
              current = finishedWork;
              finishedRoot = current.updateQueue;
              if (null !== finishedRoot) {
                var instance = current.stateNode;
                try {
                  var hiddenCallbacks = finishedRoot.shared.hiddenCallbacks;
                  if (null !== hiddenCallbacks)
                    for (finishedRoot.shared.hiddenCallbacks = null, finishedRoot = 0; finishedRoot < hiddenCallbacks.length; finishedRoot++)
                      callCallback(hiddenCallbacks[finishedRoot], instance);
                } catch (error) {
                  captureCommitPhaseError(current, current.return, error);
                }
              }
              includeWorkInProgressEffects && flags & 64 && commitClassCallbacks(finishedWork);
              safelyAttachRef(finishedWork, finishedWork.return);
              break;
            case 27:
              0 !== (layoutEffectTraversalFlags & 2) && commitHostSingletonAcquisition(finishedWork);
            case 5:
              5 !== finishedWork.tag && 27 !== finishedWork.tag || commitFragmentInstanceInsertionEffects(finishedWork);
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                layoutEffectTraversalFlags
              );
              includeWorkInProgressEffects && null === current && flags & 4 && commitHostMount(finishedWork);
              safelyAttachRef(finishedWork, finishedWork.return);
              break;
            case 6:
              commitFragmentInstanceInsertionEffects(finishedWork);
              break;
            case 26:
              instance = finishedWork.stateNode;
              null !== finishedWork.memoizedState || null === instance || offscreenSubtreeIsHidden || mountHoistable(
                getHoistableRoot(instance.ownerDocument),
                finishedWork.type,
                instance
              );
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                layoutEffectTraversalFlags
              );
              includeWorkInProgressEffects && null === current && flags & 4 && commitHostMount(finishedWork);
              safelyAttachRef(finishedWork, finishedWork.return);
              break;
            case 12:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                layoutEffectTraversalFlags
              );
              break;
            case 31:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                layoutEffectTraversalFlags
              );
              includeWorkInProgressEffects && flags & 4 && commitActivityHydrationCallbacks(finishedRoot, finishedWork);
              break;
            case 13:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                layoutEffectTraversalFlags
              );
              includeWorkInProgressEffects && flags & 4 && commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
              break;
            case 22:
              null === finishedWork.memoizedState && recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                layoutEffectTraversalFlags
              );
              safelyAttachRef(finishedWork, finishedWork.return);
              break;
            case 30:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                layoutEffectTraversalFlags
              );
              safelyAttachRef(finishedWork, finishedWork.return);
              break;
            case 7:
              safelyAttachRef(finishedWork, finishedWork.return);
            default:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                layoutEffectTraversalFlags
              );
          }
          parentFiber = parentFiber.sibling;
        }
      }
      function commitOffscreenPassiveMountEffects(current, finishedWork) {
        var previousCache = null;
        null !== current && null !== current.memoizedState && null !== current.memoizedState.cachePool && (previousCache = current.memoizedState.cachePool.pool);
        current = null;
        null !== finishedWork.memoizedState && null !== finishedWork.memoizedState.cachePool && (current = finishedWork.memoizedState.cachePool.pool);
        current !== previousCache && (null != current && current.refCount++, null != previousCache && releaseCache(previousCache));
      }
      function commitCachePassiveMountEffect(current, finishedWork) {
        current = null;
        null !== finishedWork.alternate && (current = finishedWork.alternate.memoizedState.cache);
        finishedWork = finishedWork.memoizedState.cache;
        finishedWork !== current && (finishedWork.refCount++, null != current && releaseCache(current));
      }
      function recursivelyTraversePassiveMountEffects(root2, parentFiber, committedLanes, committedTransitions) {
        var isViewTransitionEligible = (committedLanes & 335544064) === committedLanes;
        if (parentFiber.subtreeFlags & (isViewTransitionEligible ? 10262 : 10256))
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            commitPassiveMountOnFiber(
              root2,
              parentFiber,
              committedLanes,
              committedTransitions
            ), parentFiber = parentFiber.sibling;
        else isViewTransitionEligible && restoreNestedViewTransitions(parentFiber);
      }
      function commitPassiveMountOnFiber(finishedRoot, finishedWork, committedLanes, committedTransitions) {
        var isViewTransitionEligible = (committedLanes & 335544064) === committedLanes;
        isViewTransitionEligible && null === finishedWork.alternate && null !== finishedWork.return && null !== finishedWork.return.alternate && restoreEnterOrExitViewTransitions(finishedWork);
        var flags = finishedWork.flags;
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 15:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            flags & 2048 && commitHookEffectListMount(9, finishedWork);
            break;
          case 1:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            break;
          case 3:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            isViewTransitionEligible && rootViewTransitionNameCanceled && (finishedRoot = finishedRoot.containerInfo, finishedRoot = 9 === finishedRoot.nodeType ? finishedRoot.body : "HTML" === finishedRoot.nodeName ? finishedRoot.ownerDocument.body : finishedRoot, "root" === finishedRoot.style.viewTransitionName && (finishedRoot.style.viewTransitionName = ""), finishedRoot = finishedRoot.ownerDocument.documentElement, null !== finishedRoot && "none" === finishedRoot.style.viewTransitionName && (finishedRoot.style.viewTransitionName = ""));
            flags & 2048 && (flags = null, null !== finishedWork.alternate && (flags = finishedWork.alternate.memoizedState.cache), finishedWork = finishedWork.memoizedState.cache, finishedWork !== flags && (finishedWork.refCount++, null != flags && releaseCache(flags)));
            break;
          case 12:
            if (flags & 2048) {
              recursivelyTraversePassiveMountEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions
              );
              flags = finishedWork.stateNode;
              try {
                var _finishedWork$memoize2 = finishedWork.memoizedProps, id = _finishedWork$memoize2.id, onPostCommit = _finishedWork$memoize2.onPostCommit;
                "function" === typeof onPostCommit && onPostCommit(
                  id,
                  null === finishedWork.alternate ? "mount" : "update",
                  flags.passiveEffectDuration,
                  -0
                );
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            } else
              recursivelyTraversePassiveMountEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions
              );
            break;
          case 31:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            break;
          case 13:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            break;
          case 23:
            break;
          case 22:
            _finishedWork$memoize2 = finishedWork.stateNode;
            id = finishedWork.alternate;
            null !== finishedWork.memoizedState ? (isViewTransitionEligible && null !== id && null === id.memoizedState && restoreEnterOrExitViewTransitions(id), _finishedWork$memoize2._visibility & 2 ? recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            ) : recursivelyTraverseAtomicPassiveEffects(
              finishedRoot,
              finishedWork
            )) : (isViewTransitionEligible && null !== id && null !== id.memoizedState && restoreEnterOrExitViewTransitions(finishedWork), _finishedWork$memoize2._visibility & 2 ? recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            ) : (_finishedWork$memoize2._visibility |= 2, recursivelyTraverseReconnectPassiveEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions,
              0 !== (finishedWork.subtreeFlags & 10256) || false
            )));
            flags & 2048 && commitOffscreenPassiveMountEffects(id, finishedWork);
            break;
          case 24:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
            break;
          case 30:
            isViewTransitionEligible && (flags = finishedWork.alternate, null !== flags && (restoreViewTransitionOnHostInstances(flags.child, true), restoreViewTransitionOnHostInstances(finishedWork.child, true)));
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            break;
          default:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
        }
      }
      function recursivelyTraverseReconnectPassiveEffects(finishedRoot$jscomp$0, parentFiber, committedLanes$jscomp$0, committedTransitions$jscomp$0, includeWorkInProgressEffects) {
        includeWorkInProgressEffects = includeWorkInProgressEffects && (0 !== (parentFiber.subtreeFlags & 10256) || false);
        for (parentFiber = parentFiber.child; null !== parentFiber; ) {
          var finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, committedLanes = committedLanes$jscomp$0, committedTransitions = committedTransitions$jscomp$0, flags = finishedWork.flags;
          switch (finishedWork.tag) {
            case 0:
            case 11:
            case 15:
              recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              );
              commitHookEffectListMount(8, finishedWork);
              break;
            case 23:
              break;
            case 22:
              var instance = finishedWork.stateNode;
              null !== finishedWork.memoizedState ? instance._visibility & 2 ? recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              ) : recursivelyTraverseAtomicPassiveEffects(
                finishedRoot,
                finishedWork
              ) : (instance._visibility |= 2, recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              ));
              includeWorkInProgressEffects && flags & 2048 && commitOffscreenPassiveMountEffects(
                finishedWork.alternate,
                finishedWork
              );
              break;
            case 24:
              recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              );
              includeWorkInProgressEffects && flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
              break;
            default:
              recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              );
          }
          parentFiber = parentFiber.sibling;
        }
      }
      function recursivelyTraverseAtomicPassiveEffects(finishedRoot$jscomp$0, parentFiber) {
        if (parentFiber.subtreeFlags & 10256)
          for (parentFiber = parentFiber.child; null !== parentFiber; ) {
            var finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, flags = finishedWork.flags;
            switch (finishedWork.tag) {
              case 22:
                recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
                flags & 2048 && commitOffscreenPassiveMountEffects(
                  finishedWork.alternate,
                  finishedWork
                );
                break;
              case 24:
                recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
                flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
                break;
              default:
                recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
            }
            parentFiber = parentFiber.sibling;
          }
      }
      var suspenseyCommitFlag = 8192;
      function recursivelyAccumulateSuspenseyCommit(parentFiber, committedLanes, suspendedState) {
        if (parentFiber.subtreeFlags & suspenseyCommitFlag)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            accumulateSuspenseyCommitOnFiber(
              parentFiber,
              committedLanes,
              suspendedState
            ), parentFiber = parentFiber.sibling;
      }
      function accumulateSuspenseyCommitOnFiber(fiber, committedLanes, suspendedState) {
        switch (fiber.tag) {
          case 26:
            recursivelyAccumulateSuspenseyCommit(
              fiber,
              committedLanes,
              suspendedState
            );
            fiber.flags & suspenseyCommitFlag && (null !== fiber.memoizedState ? suspendResource(
              suspendedState,
              currentHoistableRoot,
              fiber.memoizedState,
              fiber.memoizedProps
            ) : (fiber = fiber.stateNode, (committedLanes & 335544128) === committedLanes && suspendInstance(suspendedState, fiber)));
            break;
          case 5:
            recursivelyAccumulateSuspenseyCommit(
              fiber,
              committedLanes,
              suspendedState
            );
            fiber.flags & suspenseyCommitFlag && (fiber = fiber.stateNode, (committedLanes & 335544128) === committedLanes && suspendInstance(suspendedState, fiber));
            break;
          case 3:
          case 4:
            var previousHoistableRoot = currentHoistableRoot;
            currentHoistableRoot = getHoistableRoot(fiber.stateNode.containerInfo);
            recursivelyAccumulateSuspenseyCommit(
              fiber,
              committedLanes,
              suspendedState
            );
            currentHoistableRoot = previousHoistableRoot;
            break;
          case 22:
            null === fiber.memoizedState && (previousHoistableRoot = fiber.alternate, null !== previousHoistableRoot && null !== previousHoistableRoot.memoizedState ? (previousHoistableRoot = suspenseyCommitFlag, suspenseyCommitFlag = 16777216, recursivelyAccumulateSuspenseyCommit(
              fiber,
              committedLanes,
              suspendedState
            ), suspenseyCommitFlag = previousHoistableRoot) : recursivelyAccumulateSuspenseyCommit(
              fiber,
              committedLanes,
              suspendedState
            ));
            break;
          case 30:
            if (0 !== (fiber.flags & suspenseyCommitFlag) && (previousHoistableRoot = fiber.memoizedProps.name, null != previousHoistableRoot && "auto" !== previousHoistableRoot)) {
              var state = fiber.stateNode;
              state.paired = null;
              null === appearingViewTransitions && (appearingViewTransitions = /* @__PURE__ */ new Map());
              appearingViewTransitions.set(previousHoistableRoot, state);
            }
            recursivelyAccumulateSuspenseyCommit(
              fiber,
              committedLanes,
              suspendedState
            );
            break;
          default:
            recursivelyAccumulateSuspenseyCommit(
              fiber,
              committedLanes,
              suspendedState
            );
        }
      }
      function detachAlternateSiblings(parentFiber) {
        var previousFiber = parentFiber.alternate;
        if (null !== previousFiber && (parentFiber = previousFiber.child, null !== parentFiber)) {
          previousFiber.child = null;
          do
            previousFiber = parentFiber.sibling, parentFiber.sibling = null, parentFiber = previousFiber;
          while (null !== parentFiber);
        }
      }
      function recursivelyTraversePassiveUnmountEffects(parentFiber) {
        var deletions = parentFiber.deletions;
        if (0 !== (parentFiber.flags & 16)) {
          if (null !== deletions)
            for (var i = 0; i < deletions.length; i++) {
              var childToDelete = deletions[i];
              nextEffect = childToDelete;
              commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
                childToDelete,
                parentFiber
              );
            }
          detachAlternateSiblings(parentFiber);
        }
        if (parentFiber.subtreeFlags & 10256)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            commitPassiveUnmountOnFiber(parentFiber), parentFiber = parentFiber.sibling;
      }
      function commitPassiveUnmountOnFiber(finishedWork) {
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 15:
            recursivelyTraversePassiveUnmountEffects(finishedWork);
            finishedWork.flags & 2048 && commitHookEffectListUnmount(9, finishedWork, finishedWork.return);
            break;
          case 3:
            recursivelyTraversePassiveUnmountEffects(finishedWork);
            break;
          case 12:
            recursivelyTraversePassiveUnmountEffects(finishedWork);
            break;
          case 22:
            var instance = finishedWork.stateNode;
            null !== finishedWork.memoizedState && instance._visibility & 2 && (null === finishedWork.return || 13 !== finishedWork.return.tag) ? (instance._visibility &= -3, recursivelyTraverseDisconnectPassiveEffects(finishedWork)) : recursivelyTraversePassiveUnmountEffects(finishedWork);
            break;
          default:
            recursivelyTraversePassiveUnmountEffects(finishedWork);
        }
      }
      function recursivelyTraverseDisconnectPassiveEffects(parentFiber) {
        var deletions = parentFiber.deletions;
        if (0 !== (parentFiber.flags & 16)) {
          if (null !== deletions)
            for (var i = 0; i < deletions.length; i++) {
              var childToDelete = deletions[i];
              nextEffect = childToDelete;
              commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
                childToDelete,
                parentFiber
              );
            }
          detachAlternateSiblings(parentFiber);
        }
        for (parentFiber = parentFiber.child; null !== parentFiber; ) {
          deletions = parentFiber;
          switch (deletions.tag) {
            case 0:
            case 11:
            case 15:
              commitHookEffectListUnmount(8, deletions, deletions.return);
              recursivelyTraverseDisconnectPassiveEffects(deletions);
              break;
            case 22:
              i = deletions.stateNode;
              i._visibility & 2 && (i._visibility &= -3, recursivelyTraverseDisconnectPassiveEffects(deletions));
              break;
            default:
              recursivelyTraverseDisconnectPassiveEffects(deletions);
          }
          parentFiber = parentFiber.sibling;
        }
      }
      function commitPassiveUnmountEffectsInsideOfDeletedTree_begin(deletedSubtreeRoot, nearestMountedAncestor) {
        for (; null !== nextEffect; ) {
          var fiber = nextEffect;
          switch (fiber.tag) {
            case 0:
            case 11:
            case 15:
              commitHookEffectListUnmount(8, fiber, nearestMountedAncestor);
              break;
            case 23:
            case 22:
              if (null !== fiber.memoizedState && null !== fiber.memoizedState.cachePool) {
                var cache = fiber.memoizedState.cachePool.pool;
                null != cache && cache.refCount++;
              }
              break;
            case 24:
              releaseCache(fiber.memoizedState.cache);
          }
          cache = fiber.child;
          if (null !== cache) cache.return = fiber, nextEffect = cache;
          else
            a: for (fiber = deletedSubtreeRoot; null !== nextEffect; ) {
              cache = nextEffect;
              var sibling = cache.sibling, returnFiber = cache.return;
              detachFiberAfterEffects(cache);
              if (cache === fiber) {
                nextEffect = null;
                break a;
              }
              if (null !== sibling) {
                sibling.return = returnFiber;
                nextEffect = sibling;
                break a;
              }
              nextEffect = returnFiber;
            }
        }
      }
      var DefaultAsyncDispatcher = {
        getCacheForType: function(resourceType) {
          var cache = readContext(CacheContext), cacheForType = cache.data.get(resourceType);
          void 0 === cacheForType && (cacheForType = resourceType(), cache.data.set(resourceType, cacheForType));
          return cacheForType;
        },
        cacheSignal: function() {
          return readContext(CacheContext).controller.signal;
        }
      };
      var PossiblyWeakMap = "function" === typeof WeakMap ? WeakMap : Map;
      var executionContext = 0;
      var workInProgressRoot = null;
      var workInProgress = null;
      var workInProgressRootRenderLanes = 0;
      var workInProgressSuspendedReason = 0;
      var workInProgressThrownValue = null;
      var workInProgressRootDidSkipSuspendedSiblings = false;
      var workInProgressRootIsPrerendering = false;
      var workInProgressRootDidAttachPingListener = false;
      var entangledRenderLanes = 0;
      var workInProgressRootExitStatus = 0;
      var workInProgressRootSkippedLanes = 0;
      var workInProgressRootInterleavedUpdatedLanes = 0;
      var workInProgressRootPingedLanes = 0;
      var workInProgressDeferredLane = 0;
      var workInProgressSuspendedRetryLanes = 0;
      var workInProgressRootConcurrentErrors = null;
      var workInProgressRootRecoverableErrors = null;
      var workInProgressRootDidIncludeRecursiveRenderUpdate = false;
      var globalMostRecentFallbackTime = 0;
      var globalMostRecentTransitionTime = 0;
      var workInProgressRootRenderTargetTime = Infinity;
      var workInProgressTransitions = null;
      var legacyErrorBoundariesThatAlreadyFailed = null;
      var pendingEffectsStatus = 0;
      var pendingEffectsRoot = null;
      var pendingFinishedWork = null;
      var pendingEffectsLanes = 0;
      var pendingEffectsRemainingLanes = 0;
      var pendingPassiveTransitions = null;
      var pendingRecoverableErrors = null;
      var pendingViewTransition = null;
      var pendingViewTransitionEvents = null;
      var pendingTransitionTypes = null;
      var nestedUpdateCount = 0;
      var rootWithNestedUpdates = null;
      function requestUpdateLane() {
        return 0 !== (executionContext & 2) && 0 !== workInProgressRootRenderLanes ? workInProgressRootRenderLanes & -workInProgressRootRenderLanes : null !== ReactSharedInternals.T ? requestTransitionLane() : resolveUpdatePriority();
      }
      function requestDeferredLane() {
        if (0 === workInProgressDeferredLane)
          if (0 === (workInProgressRootRenderLanes & 536870912) || isHydrating) {
            var lane = nextTransitionDeferredLane;
            nextTransitionDeferredLane <<= 1;
            0 === (nextTransitionDeferredLane & 3932160) && (nextTransitionDeferredLane = 262144);
            workInProgressDeferredLane = lane;
          } else workInProgressDeferredLane = 536870912;
        lane = suspenseHandlerStackCursor.current;
        null !== lane && (lane.flags |= 32);
        return workInProgressDeferredLane;
      }
      function scheduleViewTransitionEvent(fiber, callback) {
        if (null != callback) {
          var state = fiber.stateNode, instance = state.ref;
          null === instance && (instance = state.ref = createViewTransitionInstance(
            getViewTransitionName(fiber.memoizedProps, state)
          ));
          null === pendingViewTransitionEvents && (pendingViewTransitionEvents = []);
          pendingViewTransitionEvents.push(callback.bind(null, instance));
        }
      }
      function scheduleUpdateOnFiber(root2, fiber, lane) {
        if (root2 === workInProgressRoot && (2 === workInProgressSuspendedReason || 9 === workInProgressSuspendedReason) || null !== root2.cancelPendingCommit)
          prepareFreshStack(root2, 0), markRootSuspended(
            root2,
            workInProgressRootRenderLanes,
            workInProgressDeferredLane,
            false
          );
        markRootUpdated$1(root2, lane);
        if (0 === (executionContext & 2) || root2 !== workInProgressRoot)
          root2 === workInProgressRoot && (0 === (executionContext & 2) && (workInProgressRootInterleavedUpdatedLanes |= lane), 4 === workInProgressRootExitStatus && markRootSuspended(
            root2,
            workInProgressRootRenderLanes,
            workInProgressDeferredLane,
            false
          )), ensureRootIsScheduled(root2);
      }
      function performWorkOnRoot(root$jscomp$0, lanes, forceSync) {
        if (0 !== (executionContext & 6)) throw Error(formatProdErrorMessage(327));
        var shouldTimeSlice = !forceSync && 0 === (lanes & 127) && 0 === (lanes & root$jscomp$0.expiredLanes) || checkIfRootIsPrerendering(root$jscomp$0, lanes), exitStatus = shouldTimeSlice ? renderRootConcurrent(root$jscomp$0, lanes) : renderRootSync(root$jscomp$0, lanes, true), renderWasConcurrent = shouldTimeSlice;
        do {
          if (0 === exitStatus) {
            workInProgressRootIsPrerendering && !shouldTimeSlice && markRootSuspended(root$jscomp$0, lanes, 0, false);
            break;
          } else {
            forceSync = root$jscomp$0.current.alternate;
            if (renderWasConcurrent && !isRenderConsistentWithExternalStores(forceSync)) {
              exitStatus = renderRootSync(root$jscomp$0, lanes, false);
              renderWasConcurrent = false;
              continue;
            }
            if (2 === exitStatus) {
              renderWasConcurrent = lanes;
              if (root$jscomp$0.errorRecoveryDisabledLanes & renderWasConcurrent)
                var JSCompiler_inline_result = 0;
              else
                JSCompiler_inline_result = root$jscomp$0.pendingLanes & -536870913, JSCompiler_inline_result = 0 !== JSCompiler_inline_result ? JSCompiler_inline_result : JSCompiler_inline_result & 536870912 ? 536870912 : 0;
              if (0 !== JSCompiler_inline_result) {
                lanes = JSCompiler_inline_result;
                a: {
                  var root2 = root$jscomp$0;
                  exitStatus = workInProgressRootConcurrentErrors;
                  var wasRootDehydrated = root2.current.memoizedState.isDehydrated;
                  wasRootDehydrated && (prepareFreshStack(root2, JSCompiler_inline_result).flags |= 256);
                  JSCompiler_inline_result = renderRootSync(
                    root2,
                    JSCompiler_inline_result,
                    false
                  );
                  if (2 !== JSCompiler_inline_result && 6 !== JSCompiler_inline_result) {
                    if (workInProgressRootDidAttachPingListener && !wasRootDehydrated) {
                      root2.errorRecoveryDisabledLanes |= renderWasConcurrent;
                      workInProgressRootInterleavedUpdatedLanes |= renderWasConcurrent;
                      exitStatus = 4;
                      break a;
                    }
                    renderWasConcurrent = workInProgressRootRecoverableErrors;
                    workInProgressRootRecoverableErrors = exitStatus;
                    null !== renderWasConcurrent && (null === workInProgressRootRecoverableErrors ? workInProgressRootRecoverableErrors = renderWasConcurrent : workInProgressRootRecoverableErrors.push.apply(
                      workInProgressRootRecoverableErrors,
                      renderWasConcurrent
                    ));
                  }
                  exitStatus = JSCompiler_inline_result;
                }
                renderWasConcurrent = false;
                if (2 !== exitStatus) continue;
              }
            }
            if (1 === exitStatus) {
              prepareFreshStack(root$jscomp$0, 0);
              markRootSuspended(root$jscomp$0, lanes, 0, true);
              break;
            }
            a: {
              shouldTimeSlice = root$jscomp$0;
              renderWasConcurrent = exitStatus;
              switch (renderWasConcurrent) {
                case 0:
                case 1:
                  throw Error(formatProdErrorMessage(345));
                case 4:
                  if ((lanes & 4194048) !== lanes && (lanes & 62914560) !== lanes)
                    break;
                case 6:
                  markRootSuspended(
                    shouldTimeSlice,
                    lanes,
                    workInProgressDeferredLane,
                    !workInProgressRootDidSkipSuspendedSiblings
                  );
                  break a;
                case 2:
                  workInProgressRootRecoverableErrors = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(formatProdErrorMessage(329));
              }
              if ((lanes & 62914560) === lanes && (exitStatus = globalMostRecentFallbackTime + 300 - now(), 10 < exitStatus)) {
                markRootSuspended(
                  shouldTimeSlice,
                  lanes,
                  workInProgressDeferredLane,
                  !workInProgressRootDidSkipSuspendedSiblings
                );
                if (0 !== getNextLanes(shouldTimeSlice, 0, true)) break a;
                pendingEffectsLanes = lanes;
                shouldTimeSlice.timeoutHandle = scheduleTimeout(
                  completeRootWhenReady.bind(
                    null,
                    shouldTimeSlice,
                    forceSync,
                    workInProgressRootRecoverableErrors,
                    workInProgressTransitions,
                    workInProgressRootDidIncludeRecursiveRenderUpdate,
                    lanes,
                    workInProgressDeferredLane,
                    workInProgressRootInterleavedUpdatedLanes,
                    workInProgressSuspendedRetryLanes,
                    workInProgressRootDidSkipSuspendedSiblings,
                    renderWasConcurrent,
                    "Throttled",
                    -0,
                    0
                  ),
                  exitStatus
                );
                break a;
              }
              completeRootWhenReady(
                shouldTimeSlice,
                forceSync,
                workInProgressRootRecoverableErrors,
                workInProgressTransitions,
                workInProgressRootDidIncludeRecursiveRenderUpdate,
                lanes,
                workInProgressDeferredLane,
                workInProgressRootInterleavedUpdatedLanes,
                workInProgressSuspendedRetryLanes,
                workInProgressRootDidSkipSuspendedSiblings,
                renderWasConcurrent,
                null,
                -0,
                0
              );
            }
          }
          break;
        } while (1);
        ensureRootIsScheduled(root$jscomp$0);
      }
      function completeRootWhenReady(root2, finishedWork, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, lanes, spawnedLane, updatedLanes, suspendedRetryLanes, didSkipSuspendedSiblings, exitStatus, suspendedCommitReason, completedRenderStartTime, completedRenderEndTime) {
        root2.timeoutHandle = -1;
        var subtreeFlags = finishedWork.subtreeFlags, isViewTransitionEligible = (lanes & 335544064) === lanes;
        suspendedCommitReason = null;
        if (isViewTransitionEligible || subtreeFlags & 8192 || 16785408 === (subtreeFlags & 16785408)) {
          if (suspendedCommitReason = {
            stylesheets: null,
            count: 0,
            imgCount: 0,
            imgBytes: 0,
            suspenseyImages: [],
            waitingForImages: true,
            waitingForViewTransition: false,
            unsuspend: noop$1
          }, appearingViewTransitions = null, accumulateSuspenseyCommitOnFiber(
            finishedWork,
            lanes,
            suspendedCommitReason
          ), isViewTransitionEligible && (subtreeFlags = suspendedCommitReason, isViewTransitionEligible = root2.containerInfo, isViewTransitionEligible = (9 === isViewTransitionEligible.nodeType ? isViewTransitionEligible : isViewTransitionEligible.ownerDocument).__reactViewTransition, null != isViewTransitionEligible && (subtreeFlags.count++, subtreeFlags.waitingForViewTransition = true, subtreeFlags = onUnsuspend.bind(subtreeFlags), isViewTransitionEligible.finished.then(subtreeFlags, subtreeFlags))), subtreeFlags = (lanes & 62914560) === lanes ? globalMostRecentFallbackTime - now() : (lanes & 4194048) === lanes ? globalMostRecentTransitionTime - now() : 0, subtreeFlags = waitForCommitToBeReady(
            suspendedCommitReason,
            subtreeFlags
          ), null !== subtreeFlags) {
            pendingEffectsLanes = lanes;
            root2.cancelPendingCommit = subtreeFlags(
              completeRoot.bind(
                null,
                root2,
                finishedWork,
                lanes,
                recoverableErrors,
                transitions,
                didIncludeRenderPhaseUpdate,
                spawnedLane,
                updatedLanes,
                suspendedRetryLanes,
                didSkipSuspendedSiblings,
                exitStatus,
                suspendedCommitReason,
                null,
                completedRenderStartTime,
                completedRenderEndTime
              )
            );
            markRootSuspended(root2, lanes, spawnedLane, !didSkipSuspendedSiblings);
            return;
          }
        }
        completeRoot(
          root2,
          finishedWork,
          lanes,
          recoverableErrors,
          transitions,
          didIncludeRenderPhaseUpdate,
          spawnedLane,
          updatedLanes,
          suspendedRetryLanes,
          didSkipSuspendedSiblings,
          exitStatus,
          suspendedCommitReason
        );
      }
      function isRenderConsistentWithExternalStores(finishedWork) {
        for (var node = finishedWork; ; ) {
          var tag = node.tag;
          if ((0 === tag || 11 === tag || 15 === tag) && node.flags & 16384 && (tag = node.updateQueue, null !== tag && (tag = tag.stores, null !== tag)))
            for (var i = 0; i < tag.length; i++) {
              var check = tag[i], getSnapshot = check.getSnapshot;
              check = check.value;
              try {
                if (!objectIs(getSnapshot(), check)) return false;
              } catch (error) {
                return false;
              }
            }
          tag = node.child;
          if (node.subtreeFlags & 16384 && null !== tag)
            tag.return = node, node = tag;
          else {
            if (node === finishedWork) break;
            for (; null === node.sibling; ) {
              if (null === node.return || node.return === finishedWork) return true;
              node = node.return;
            }
            node.sibling.return = node.return;
            node = node.sibling;
          }
        }
        return true;
      }
      function markRootSuspended(root2, suspendedLanes, spawnedLane, didAttemptEntireTree) {
        suspendedLanes = getEntangledLanes(root2, suspendedLanes);
        suspendedLanes &= ~workInProgressRootPingedLanes;
        suspendedLanes &= ~workInProgressRootInterleavedUpdatedLanes;
        root2.suspendedLanes |= suspendedLanes;
        root2.pingedLanes &= ~suspendedLanes;
        didAttemptEntireTree && (root2.warmLanes |= suspendedLanes);
        didAttemptEntireTree = root2.expirationTimes;
        for (var lanes = suspendedLanes; 0 < lanes; ) {
          var index$6 = 31 - clz32(lanes), lane = 1 << index$6;
          didAttemptEntireTree[index$6] = -1;
          lanes &= ~lane;
        }
        0 !== spawnedLane && markSpawnedDeferredLane(root2, spawnedLane, suspendedLanes);
      }
      function flushSyncWork$1() {
        return 0 === (executionContext & 6) ? (flushSyncWorkAcrossRoots_impl(0, false), false) : true;
      }
      function resetWorkInProgressStack() {
        if (null !== workInProgress) {
          if (0 === workInProgressSuspendedReason)
            var interruptedWork = workInProgress.return;
          else
            interruptedWork = workInProgress, lastContextDependency = currentlyRenderingFiber$1 = null, resetHooksOnUnwind(interruptedWork), thenableState$1 = null, thenableIndexCounter$1 = 0, interruptedWork = workInProgress;
          for (; null !== interruptedWork; )
            unwindInterruptedWork(interruptedWork.alternate, interruptedWork), interruptedWork = interruptedWork.return;
          workInProgress = null;
        }
      }
      function prepareFreshStack(root2, lanes) {
        var timeoutHandle = root2.timeoutHandle;
        -1 !== timeoutHandle && (root2.timeoutHandle = -1, cancelTimeout(timeoutHandle));
        timeoutHandle = root2.cancelPendingCommit;
        null !== timeoutHandle && (root2.cancelPendingCommit = null, timeoutHandle());
        pendingEffectsLanes = 0;
        resetWorkInProgressStack();
        workInProgressRoot = root2;
        workInProgress = timeoutHandle = createWorkInProgress(root2.current, null);
        workInProgressRootRenderLanes = lanes;
        workInProgressSuspendedReason = 0;
        workInProgressThrownValue = null;
        workInProgressRootDidSkipSuspendedSiblings = false;
        workInProgressRootIsPrerendering = checkIfRootIsPrerendering(root2, lanes);
        workInProgressRootDidAttachPingListener = false;
        workInProgressSuspendedRetryLanes = workInProgressDeferredLane = workInProgressRootPingedLanes = workInProgressRootInterleavedUpdatedLanes = workInProgressRootSkippedLanes = workInProgressRootExitStatus = 0;
        workInProgressRootRecoverableErrors = workInProgressRootConcurrentErrors = null;
        workInProgressRootDidIncludeRecursiveRenderUpdate = false;
        entangledRenderLanes = getEntangledLanes(root2, lanes);
        finishQueueingConcurrentUpdates();
        return timeoutHandle;
      }
      function handleThrow(root2, thrownValue) {
        currentlyRenderingFiber = null;
        ReactSharedInternals.H = ContextOnlyDispatcher;
        thrownValue === SuspenseException || thrownValue === SuspenseActionException ? (thrownValue = getSuspendedThenable(), workInProgressSuspendedReason = 3) : thrownValue === SuspenseyCommitException ? (thrownValue = getSuspendedThenable(), workInProgressSuspendedReason = 4) : workInProgressSuspendedReason = thrownValue === SelectiveHydrationException ? 8 : null !== thrownValue && "object" === typeof thrownValue && "function" === typeof thrownValue.then ? 6 : 1;
        workInProgressThrownValue = thrownValue;
        null === workInProgress && (workInProgressRootExitStatus = 1, logUncaughtError(
          root2,
          createCapturedValueAtFiber(thrownValue, root2.current)
        ));
      }
      function shouldRemainOnPreviousScreen() {
        var handler = suspenseHandlerStackCursor.current;
        return null === handler ? true : (workInProgressRootRenderLanes & 4194048) === workInProgressRootRenderLanes ? null === shellBoundary ? true : false : (workInProgressRootRenderLanes & 62914560) === workInProgressRootRenderLanes || 0 !== (workInProgressRootRenderLanes & 536870912) ? handler === shellBoundary : false;
      }
      function pushDispatcher() {
        var prevDispatcher = ReactSharedInternals.H;
        ReactSharedInternals.H = ContextOnlyDispatcher;
        return null === prevDispatcher ? ContextOnlyDispatcher : prevDispatcher;
      }
      function pushAsyncDispatcher() {
        var prevAsyncDispatcher = ReactSharedInternals.A;
        ReactSharedInternals.A = DefaultAsyncDispatcher;
        return prevAsyncDispatcher;
      }
      function renderDidSuspendDelayIfPossible() {
        workInProgressRootExitStatus = 4;
        workInProgressRootDidSkipSuspendedSiblings || (workInProgressRootRenderLanes & 4194048) !== workInProgressRootRenderLanes && null !== suspenseHandlerStackCursor.current || (workInProgressRootIsPrerendering = true);
        0 === (workInProgressRootSkippedLanes & 134217727) && 0 === (workInProgressRootInterleavedUpdatedLanes & 134217727) || null === workInProgressRoot || markRootSuspended(
          workInProgressRoot,
          workInProgressRootRenderLanes,
          workInProgressDeferredLane,
          false
        );
      }
      function renderRootSync(root2, lanes, shouldYieldForPrerendering) {
        var prevExecutionContext = executionContext;
        executionContext |= 2;
        var prevDispatcher = pushDispatcher(), prevAsyncDispatcher = pushAsyncDispatcher();
        if (workInProgressRoot !== root2 || workInProgressRootRenderLanes !== lanes)
          workInProgressTransitions = null, prepareFreshStack(root2, lanes);
        lanes = false;
        var exitStatus = workInProgressRootExitStatus;
        a: do
          try {
            if (0 !== workInProgressSuspendedReason && null !== workInProgress) {
              var unitOfWork = workInProgress, thrownValue = workInProgressThrownValue;
              switch (workInProgressSuspendedReason) {
                case 8:
                  resetWorkInProgressStack();
                  exitStatus = 6;
                  break a;
                case 3:
                case 2:
                case 9:
                case 6:
                  null === suspenseHandlerStackCursor.current && (lanes = true);
                  var reason = workInProgressSuspendedReason;
                  workInProgressSuspendedReason = 0;
                  workInProgressThrownValue = null;
                  throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, reason);
                  if (shouldYieldForPrerendering && workInProgressRootIsPrerendering) {
                    exitStatus = 0;
                    break a;
                  }
                  break;
                default:
                  reason = workInProgressSuspendedReason, workInProgressSuspendedReason = 0, workInProgressThrownValue = null, throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, reason);
              }
            }
            workLoopSync();
            exitStatus = workInProgressRootExitStatus;
            break;
          } catch (thrownValue$184) {
            handleThrow(root2, thrownValue$184);
          }
        while (1);
        lanes && root2.shellSuspendCounter++;
        lastContextDependency = currentlyRenderingFiber$1 = null;
        executionContext = prevExecutionContext;
        ReactSharedInternals.H = prevDispatcher;
        ReactSharedInternals.A = prevAsyncDispatcher;
        null === workInProgress && (workInProgressRoot = null, workInProgressRootRenderLanes = 0, finishQueueingConcurrentUpdates());
        return exitStatus;
      }
      function workLoopSync() {
        for (; null !== workInProgress; ) performUnitOfWork(workInProgress);
      }
      function renderRootConcurrent(root2, lanes) {
        var prevExecutionContext = executionContext;
        executionContext |= 2;
        var prevDispatcher = pushDispatcher(), prevAsyncDispatcher = pushAsyncDispatcher();
        workInProgressRoot !== root2 || workInProgressRootRenderLanes !== lanes ? (workInProgressTransitions = null, workInProgressRootRenderTargetTime = now() + 500, prepareFreshStack(root2, lanes)) : workInProgressRootIsPrerendering = checkIfRootIsPrerendering(
          root2,
          lanes
        );
        a: do
          try {
            if (0 !== workInProgressSuspendedReason && null !== workInProgress) {
              lanes = workInProgress;
              var thrownValue = workInProgressThrownValue;
              b: switch (workInProgressSuspendedReason) {
                case 1:
                  workInProgressSuspendedReason = 0;
                  workInProgressThrownValue = null;
                  throwAndUnwindWorkLoop(root2, lanes, thrownValue, 1);
                  break;
                case 2:
                case 9:
                  if (isThenableResolved(thrownValue)) {
                    workInProgressSuspendedReason = 0;
                    workInProgressThrownValue = null;
                    replaySuspendedUnitOfWork(lanes);
                    break;
                  }
                  lanes = function() {
                    2 !== workInProgressSuspendedReason && 9 !== workInProgressSuspendedReason || workInProgressRoot !== root2 || (workInProgressSuspendedReason = 7);
                    ensureRootIsScheduled(root2);
                  };
                  thrownValue.then(lanes, lanes);
                  break a;
                case 3:
                  workInProgressSuspendedReason = 7;
                  break a;
                case 4:
                  workInProgressSuspendedReason = 5;
                  break a;
                case 7:
                  isThenableResolved(thrownValue) ? (workInProgressSuspendedReason = 0, workInProgressThrownValue = null, replaySuspendedUnitOfWork(lanes)) : (workInProgressSuspendedReason = 0, workInProgressThrownValue = null, throwAndUnwindWorkLoop(root2, lanes, thrownValue, 7));
                  break;
                case 5:
                  var resource = null;
                  switch (workInProgress.tag) {
                    case 26:
                      resource = workInProgress.memoizedState;
                    case 5:
                    case 27:
                      var hostFiber = workInProgress;
                      if (resource ? preloadResource(resource) : hostFiber.stateNode.complete) {
                        workInProgressSuspendedReason = 0;
                        workInProgressThrownValue = null;
                        var sibling = hostFiber.sibling;
                        if (null !== sibling) workInProgress = sibling;
                        else {
                          var returnFiber = hostFiber.return;
                          null !== returnFiber ? (workInProgress = returnFiber, completeUnitOfWork(returnFiber)) : workInProgress = null;
                        }
                        break b;
                      }
                  }
                  workInProgressSuspendedReason = 0;
                  workInProgressThrownValue = null;
                  throwAndUnwindWorkLoop(root2, lanes, thrownValue, 5);
                  break;
                case 6:
                  workInProgressSuspendedReason = 0;
                  workInProgressThrownValue = null;
                  throwAndUnwindWorkLoop(root2, lanes, thrownValue, 6);
                  break;
                case 8:
                  resetWorkInProgressStack();
                  workInProgressRootExitStatus = 6;
                  break a;
                default:
                  throw Error(formatProdErrorMessage(462));
              }
            }
            workLoopConcurrentByScheduler();
            break;
          } catch (thrownValue$186) {
            handleThrow(root2, thrownValue$186);
          }
        while (1);
        lastContextDependency = currentlyRenderingFiber$1 = null;
        ReactSharedInternals.H = prevDispatcher;
        ReactSharedInternals.A = prevAsyncDispatcher;
        executionContext = prevExecutionContext;
        if (null !== workInProgress) return 0;
        workInProgressRoot = null;
        workInProgressRootRenderLanes = 0;
        finishQueueingConcurrentUpdates();
        return workInProgressRootExitStatus;
      }
      function workLoopConcurrentByScheduler() {
        for (; null !== workInProgress && !shouldYield(); )
          performUnitOfWork(workInProgress);
      }
      function performUnitOfWork(unitOfWork) {
        var next = beginWork(unitOfWork.alternate, unitOfWork, entangledRenderLanes);
        unitOfWork.memoizedProps = unitOfWork.pendingProps;
        null === next ? completeUnitOfWork(unitOfWork) : workInProgress = next;
      }
      function replaySuspendedUnitOfWork(unitOfWork) {
        var next = unitOfWork;
        var current = next.alternate;
        switch (next.tag) {
          case 15:
          case 0:
            next = replayFunctionComponent(
              current,
              next,
              next.pendingProps,
              next.type,
              void 0,
              workInProgressRootRenderLanes
            );
            break;
          case 11:
            next = replayFunctionComponent(
              current,
              next,
              next.pendingProps,
              next.type.render,
              next.ref,
              workInProgressRootRenderLanes
            );
            break;
          case 5:
            resetHooksOnUnwind(next);
            var fiber = next;
            fiber === hydrationParentFiber && (isHydrating ? (popToNextHostParent(fiber), 5 === fiber.tag && null != fiber.stateNode && (nextHydratableInstance = fiber.stateNode)) : (popToNextHostParent(fiber), isHydrating = true));
          default:
            unwindInterruptedWork(current, next), next = workInProgress = resetWorkInProgress(next, entangledRenderLanes), next = beginWork(current, next, entangledRenderLanes);
        }
        unitOfWork.memoizedProps = unitOfWork.pendingProps;
        null === next ? completeUnitOfWork(unitOfWork) : workInProgress = next;
      }
      function throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, suspendedReason) {
        lastContextDependency = currentlyRenderingFiber$1 = null;
        resetHooksOnUnwind(unitOfWork);
        thenableState$1 = null;
        thenableIndexCounter$1 = 0;
        var returnFiber = unitOfWork.return;
        try {
          if (throwException(
            root2,
            returnFiber,
            unitOfWork,
            thrownValue,
            workInProgressRootRenderLanes
          )) {
            workInProgressRootExitStatus = 1;
            logUncaughtError(
              root2,
              createCapturedValueAtFiber(thrownValue, root2.current)
            );
            workInProgress = null;
            return;
          }
        } catch (error) {
          if (null !== returnFiber) throw workInProgress = returnFiber, error;
          workInProgressRootExitStatus = 1;
          logUncaughtError(
            root2,
            createCapturedValueAtFiber(thrownValue, root2.current)
          );
          workInProgress = null;
          return;
        }
        if (unitOfWork.flags & 32768) {
          if (isHydrating || 1 === suspendedReason) root2 = true;
          else if (workInProgressRootIsPrerendering || 0 !== (workInProgressRootRenderLanes & 536870912))
            root2 = false;
          else if (workInProgressRootDidSkipSuspendedSiblings = root2 = true, 2 === suspendedReason || 9 === suspendedReason || 3 === suspendedReason || 6 === suspendedReason)
            suspendedReason = suspenseHandlerStackCursor.current, null !== suspendedReason && 13 === suspendedReason.tag && (suspendedReason.flags |= 16384);
          unwindUnitOfWork(unitOfWork, root2);
        } else completeUnitOfWork(unitOfWork);
      }
      function completeUnitOfWork(unitOfWork) {
        var completedWork = unitOfWork;
        do {
          if (0 !== (completedWork.flags & 32768)) {
            unwindUnitOfWork(
              completedWork,
              workInProgressRootDidSkipSuspendedSiblings
            );
            return;
          }
          unitOfWork = completedWork.return;
          var next = completeWork(
            completedWork.alternate,
            completedWork,
            entangledRenderLanes
          );
          if (null !== next) {
            workInProgress = next;
            return;
          }
          completedWork = completedWork.sibling;
          if (null !== completedWork) {
            workInProgress = completedWork;
            return;
          }
          workInProgress = completedWork = unitOfWork;
        } while (null !== completedWork);
        0 === workInProgressRootExitStatus && (workInProgressRootExitStatus = 5);
      }
      function unwindUnitOfWork(unitOfWork, skipSiblings) {
        do {
          var next = unwindWork(unitOfWork.alternate, unitOfWork);
          if (null !== next) {
            next.flags &= 32767;
            workInProgress = next;
            return;
          }
          next = unitOfWork.return;
          null !== next && (next.flags |= 32768, next.subtreeFlags = 0, next.deletions = null);
          if (!skipSiblings && (unitOfWork = unitOfWork.sibling, null !== unitOfWork)) {
            workInProgress = unitOfWork;
            return;
          }
          workInProgress = unitOfWork = next;
        } while (null !== unitOfWork);
        workInProgressRootExitStatus = 6;
        workInProgress = null;
      }
      function completeRoot(root2, finishedWork, lanes, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, spawnedLane, updatedLanes, suspendedRetryLanes, didSkipSuspendedSiblings, exitStatus, suspendedState) {
        root2.cancelPendingCommit = null;
        do
          flushPendingEffects();
        while (0 !== pendingEffectsStatus);
        if (0 !== (executionContext & 6)) throw Error(formatProdErrorMessage(327));
        if (null !== finishedWork) {
          if (finishedWork === root2.current) throw Error(formatProdErrorMessage(177));
          root2 === workInProgressRoot && (workInProgress = workInProgressRoot = null, workInProgressRootRenderLanes = 0);
          pendingFinishedWork = finishedWork;
          pendingEffectsRoot = root2;
          pendingEffectsLanes = lanes;
          pendingPassiveTransitions = transitions;
          pendingRecoverableErrors = recoverableErrors;
          commitRoot(
            root2,
            finishedWork,
            lanes,
            spawnedLane,
            updatedLanes,
            suspendedRetryLanes,
            suspendedState
          );
        }
      }
      function commitRoot(root2, finishedWork, lanes, spawnedLane, updatedLanes, suspendedRetryLanes, suspendedState) {
        var remainingLanes = finishedWork.lanes | finishedWork.childLanes;
        pendingEffectsRemainingLanes = remainingLanes;
        remainingLanes |= concurrentlyUpdatedLanes;
        markRootFinished(
          root2,
          lanes,
          remainingLanes,
          spawnedLane,
          updatedLanes,
          suspendedRetryLanes
        );
        pendingViewTransitionEvents = null;
        (lanes & 335544064) === lanes ? (pendingTransitionTypes = claimQueuedTransitionTypes(root2), spawnedLane = 10262) : (pendingTransitionTypes = null, spawnedLane = 10256);
        0 !== (finishedWork.subtreeFlags & spawnedLane) || 0 !== (finishedWork.flags & spawnedLane) ? (root2.callbackNode = null, root2.callbackPriority = 0, scheduleCallback$1(NormalPriority$1, function() {
          flushPassiveEffects();
          return null;
        })) : (root2.callbackNode = null, root2.callbackPriority = 0);
        shouldStartViewTransition = false;
        spawnedLane = 0 !== (finishedWork.flags & 13878);
        if (0 !== (finishedWork.subtreeFlags & 13878) || spawnedLane) {
          spawnedLane = ReactSharedInternals.T;
          ReactSharedInternals.T = null;
          updatedLanes = ReactDOMSharedInternals.p;
          ReactDOMSharedInternals.p = 2;
          suspendedRetryLanes = executionContext;
          executionContext |= 4;
          try {
            commitBeforeMutationEffects(root2, finishedWork, lanes);
          } finally {
            executionContext = suspendedRetryLanes, ReactDOMSharedInternals.p = updatedLanes, ReactSharedInternals.T = spawnedLane;
          }
        }
        pendingEffectsStatus = 1;
        shouldStartViewTransition ? pendingViewTransition = startViewTransition(
          suspendedState,
          root2.containerInfo,
          pendingTransitionTypes,
          flushMutationEffects,
          flushLayoutEffects,
          flushAfterMutationEffects,
          flushSpawnedWork,
          flushPassiveEffects,
          reportViewTransitionError,
          null,
          null
        ) : (flushMutationEffects(), flushLayoutEffects(), flushSpawnedWork());
      }
      function reportViewTransitionError(error) {
        if (0 !== pendingEffectsStatus) {
          var onRecoverableError = pendingEffectsRoot.onRecoverableError;
          onRecoverableError(error, { componentStack: null });
        }
      }
      function flushAfterMutationEffects() {
        3 === pendingEffectsStatus && (pendingEffectsStatus = 0, commitAfterMutationEffectsOnFiber(pendingFinishedWork, pendingEffectsRoot), pendingEffectsStatus = 4);
      }
      function flushMutationEffects() {
        if (1 === pendingEffectsStatus) {
          pendingEffectsStatus = 0;
          var root2 = pendingEffectsRoot, finishedWork = pendingFinishedWork, lanes = pendingEffectsLanes, rootMutationHasEffect = 0 !== (finishedWork.flags & 13878);
          if (0 !== (finishedWork.subtreeFlags & 13878) || rootMutationHasEffect) {
            rootMutationHasEffect = ReactSharedInternals.T;
            ReactSharedInternals.T = null;
            var previousPriority = ReactDOMSharedInternals.p;
            ReactDOMSharedInternals.p = 2;
            var prevExecutionContext = executionContext;
            executionContext |= 4;
            try {
              inUpdateViewTransition = rootViewTransitionAffected = false;
              commitMutationEffectsOnFiber(finishedWork, root2, lanes);
              lanes = selectionInformation;
              var curFocusedElem = getActiveElementDeep(root2.containerInfo), priorFocusedElem = lanes.focusedElem, priorSelectionRange = lanes.selectionRange;
              if (curFocusedElem !== priorFocusedElem && priorFocusedElem && priorFocusedElem.ownerDocument && containsNode(
                priorFocusedElem.ownerDocument.documentElement,
                priorFocusedElem
              )) {
                if (null !== priorSelectionRange && hasSelectionCapabilities(priorFocusedElem)) {
                  var start = priorSelectionRange.start, end = priorSelectionRange.end;
                  void 0 === end && (end = start);
                  if ("selectionStart" in priorFocusedElem)
                    priorFocusedElem.selectionStart = start, priorFocusedElem.selectionEnd = Math.min(
                      end,
                      priorFocusedElem.value.length
                    );
                  else {
                    var doc = priorFocusedElem.ownerDocument || document, win = doc && doc.defaultView || window;
                    if (win.getSelection) {
                      var selection = win.getSelection(), length = priorFocusedElem.textContent.length, start$jscomp$0 = Math.min(priorSelectionRange.start, length), end$jscomp$0 = void 0 === priorSelectionRange.end ? start$jscomp$0 : Math.min(priorSelectionRange.end, length);
                      !selection.extend && start$jscomp$0 > end$jscomp$0 && (curFocusedElem = end$jscomp$0, end$jscomp$0 = start$jscomp$0, start$jscomp$0 = curFocusedElem);
                      var startMarker = getNodeForCharacterOffset(
                        priorFocusedElem,
                        start$jscomp$0
                      ), endMarker = getNodeForCharacterOffset(
                        priorFocusedElem,
                        end$jscomp$0
                      );
                      if (startMarker && endMarker && (1 !== selection.rangeCount || selection.anchorNode !== startMarker.node || selection.anchorOffset !== startMarker.offset || selection.focusNode !== endMarker.node || selection.focusOffset !== endMarker.offset)) {
                        var range = doc.createRange();
                        range.setStart(startMarker.node, startMarker.offset);
                        selection.removeAllRanges();
                        start$jscomp$0 > end$jscomp$0 ? (selection.addRange(range), selection.extend(endMarker.node, endMarker.offset)) : (range.setEnd(endMarker.node, endMarker.offset), selection.addRange(range));
                      }
                    }
                  }
                }
                doc = [];
                for (selection = priorFocusedElem; selection = selection.parentNode; )
                  1 === selection.nodeType && doc.push({
                    element: selection,
                    left: selection.scrollLeft,
                    top: selection.scrollTop
                  });
                "function" === typeof priorFocusedElem.focus && priorFocusedElem.focus();
                for (priorFocusedElem = 0; priorFocusedElem < doc.length; priorFocusedElem++) {
                  var info = doc[priorFocusedElem];
                  info.element.scrollLeft = info.left;
                  info.element.scrollTop = info.top;
                }
              }
              _enabled = !!eventsEnabled;
              selectionInformation = eventsEnabled = null;
            } finally {
              executionContext = prevExecutionContext, ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = rootMutationHasEffect;
            }
          }
          root2.current = finishedWork;
          pendingEffectsStatus = 2;
        }
      }
      function flushLayoutEffects() {
        if (2 === pendingEffectsStatus) {
          pendingEffectsStatus = 0;
          var root2 = pendingEffectsRoot, finishedWork = pendingFinishedWork, rootHasLayoutEffect = 0 !== (finishedWork.flags & 8772);
          if (0 !== (finishedWork.subtreeFlags & 8772) || rootHasLayoutEffect) {
            rootHasLayoutEffect = ReactSharedInternals.T;
            ReactSharedInternals.T = null;
            var previousPriority = ReactDOMSharedInternals.p;
            ReactDOMSharedInternals.p = 2;
            var prevExecutionContext = executionContext;
            executionContext |= 4;
            try {
              commitLayoutEffectOnFiber(root2, finishedWork.alternate, finishedWork);
            } finally {
              executionContext = prevExecutionContext, ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = rootHasLayoutEffect;
            }
          }
          pendingEffectsStatus = 3;
        }
      }
      function flushSpawnedWork() {
        if (4 === pendingEffectsStatus || 3 === pendingEffectsStatus) {
          pendingEffectsStatus = 0;
          var committedViewTransition = pendingViewTransition;
          pendingViewTransition = null;
          requestPaint();
          var root2 = pendingEffectsRoot, finishedWork = pendingFinishedWork, lanes = pendingEffectsLanes, recoverableErrors = pendingRecoverableErrors, passiveSubtreeMask = (lanes & 335544064) === lanes ? 10262 : 10256;
          0 !== (finishedWork.subtreeFlags & passiveSubtreeMask) || 0 !== (finishedWork.flags & passiveSubtreeMask) ? pendingEffectsStatus = 5 : (pendingEffectsStatus = 0, pendingFinishedWork = pendingEffectsRoot = null, releaseRootPooledCache(root2, root2.pendingLanes));
          passiveSubtreeMask = root2.pendingLanes;
          0 === passiveSubtreeMask && (legacyErrorBoundariesThatAlreadyFailed = null);
          lanesToEventPriority(lanes);
          finishedWork = finishedWork.stateNode;
          if (injectedHook && "function" === typeof injectedHook.onCommitFiberRoot)
            try {
              injectedHook.onCommitFiberRoot(
                rendererID,
                finishedWork,
                void 0,
                128 === (finishedWork.current.flags & 128)
              );
            } catch (err) {
            }
          if (null !== recoverableErrors) {
            finishedWork = ReactSharedInternals.T;
            passiveSubtreeMask = ReactDOMSharedInternals.p;
            ReactDOMSharedInternals.p = 2;
            ReactSharedInternals.T = null;
            try {
              for (var onRecoverableError = root2.onRecoverableError, i = 0; i < recoverableErrors.length; i++) {
                var recoverableError = recoverableErrors[i];
                onRecoverableError(recoverableError.value, {
                  componentStack: recoverableError.stack
                });
              }
            } finally {
              ReactSharedInternals.T = finishedWork, ReactDOMSharedInternals.p = passiveSubtreeMask;
            }
          }
          recoverableErrors = pendingViewTransitionEvents;
          onRecoverableError = pendingTransitionTypes;
          pendingTransitionTypes = null;
          if (null !== recoverableErrors && (pendingViewTransitionEvents = null, null === onRecoverableError && (onRecoverableError = []), null !== committedViewTransition))
            for (recoverableError = 0; recoverableError < recoverableErrors.length; recoverableError++)
              finishedWork = (0, recoverableErrors[recoverableError])(
                onRecoverableError
              ), void 0 !== finishedWork && committedViewTransition.finished.finally(finishedWork);
          0 !== (pendingEffectsLanes & 3) && flushPendingEffects();
          ensureRootIsScheduled(root2);
          passiveSubtreeMask = root2.pendingLanes;
          0 !== (lanes & 261930) && 0 !== (passiveSubtreeMask & 42) ? root2 === rootWithNestedUpdates ? nestedUpdateCount++ : (nestedUpdateCount = 0, rootWithNestedUpdates = root2) : (nestedUpdateCount = 0, rootWithNestedUpdates = null);
          flushSyncWorkAcrossRoots_impl(0, false);
        }
      }
      function releaseRootPooledCache(root2, remainingLanes) {
        0 === (root2.pooledCacheLanes &= remainingLanes) && (remainingLanes = root2.pooledCache, null != remainingLanes && (root2.pooledCache = null, releaseCache(remainingLanes)));
      }
      function flushPendingEffects() {
        null !== pendingViewTransition && (pendingViewTransition.skipTransition(), pendingViewTransition = null);
        flushMutationEffects();
        flushLayoutEffects();
        flushSpawnedWork();
        return flushPassiveEffects();
      }
      function flushPassiveEffects() {
        if (5 !== pendingEffectsStatus) return false;
        var root2 = pendingEffectsRoot, remainingLanes = pendingEffectsRemainingLanes;
        pendingEffectsRemainingLanes = 0;
        var renderPriority = lanesToEventPriority(pendingEffectsLanes), prevTransition = ReactSharedInternals.T, previousPriority = ReactDOMSharedInternals.p;
        try {
          ReactDOMSharedInternals.p = 32 > renderPriority ? 32 : renderPriority;
          ReactSharedInternals.T = null;
          renderPriority = pendingPassiveTransitions;
          pendingPassiveTransitions = null;
          var root$jscomp$0 = pendingEffectsRoot, lanes = pendingEffectsLanes;
          pendingEffectsStatus = 0;
          pendingFinishedWork = pendingEffectsRoot = null;
          pendingEffectsLanes = 0;
          if (0 !== (executionContext & 6)) throw Error(formatProdErrorMessage(331));
          var prevExecutionContext = executionContext;
          executionContext |= 4;
          commitPassiveUnmountOnFiber(root$jscomp$0.current);
          commitPassiveMountOnFiber(
            root$jscomp$0,
            root$jscomp$0.current,
            lanes,
            renderPriority
          );
          executionContext = prevExecutionContext;
          flushSyncWorkAcrossRoots_impl(0, false);
          if (injectedHook && "function" === typeof injectedHook.onPostCommitFiberRoot)
            try {
              injectedHook.onPostCommitFiberRoot(rendererID, root$jscomp$0);
            } catch (err) {
            }
          return true;
        } finally {
          ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition, releaseRootPooledCache(root2, remainingLanes);
        }
      }
      function captureCommitPhaseErrorOnRoot(rootFiber, sourceFiber, error) {
        sourceFiber = createCapturedValueAtFiber(error, sourceFiber);
        sourceFiber = createRootErrorUpdate(rootFiber.stateNode, sourceFiber, 2);
        rootFiber = enqueueUpdate(rootFiber, sourceFiber, 2);
        null !== rootFiber && (markRootUpdated$1(rootFiber, 2), ensureRootIsScheduled(rootFiber));
      }
      function captureCommitPhaseError(sourceFiber, nearestMountedAncestor, error) {
        if (3 === sourceFiber.tag)
          captureCommitPhaseErrorOnRoot(sourceFiber, sourceFiber, error);
        else
          for (; null !== nearestMountedAncestor; ) {
            if (3 === nearestMountedAncestor.tag) {
              captureCommitPhaseErrorOnRoot(
                nearestMountedAncestor,
                sourceFiber,
                error
              );
              break;
            } else if (1 === nearestMountedAncestor.tag) {
              var instance = nearestMountedAncestor.stateNode;
              if ("function" === typeof nearestMountedAncestor.type.getDerivedStateFromError || "function" === typeof instance.componentDidCatch && (null === legacyErrorBoundariesThatAlreadyFailed || !legacyErrorBoundariesThatAlreadyFailed.has(instance))) {
                sourceFiber = createCapturedValueAtFiber(error, sourceFiber);
                error = createClassErrorUpdate(2);
                instance = enqueueUpdate(nearestMountedAncestor, error, 2);
                null !== instance && (initializeClassErrorUpdate(
                  error,
                  instance,
                  nearestMountedAncestor,
                  sourceFiber
                ), markRootUpdated$1(instance, 2), ensureRootIsScheduled(instance));
                break;
              }
            }
            nearestMountedAncestor = nearestMountedAncestor.return;
          }
      }
      function attachPingListener(root2, wakeable, lanes) {
        var pingCache = root2.pingCache;
        if (null === pingCache) {
          pingCache = root2.pingCache = new PossiblyWeakMap();
          var threadIDs = /* @__PURE__ */ new Set();
          pingCache.set(wakeable, threadIDs);
        } else
          threadIDs = pingCache.get(wakeable), void 0 === threadIDs && (threadIDs = /* @__PURE__ */ new Set(), pingCache.set(wakeable, threadIDs));
        threadIDs.has(lanes) || (workInProgressRootDidAttachPingListener = true, threadIDs.add(lanes), root2 = pingSuspendedRoot.bind(null, root2, wakeable, lanes), wakeable.then(root2, root2));
      }
      function pingSuspendedRoot(root2, wakeable, pingedLanes) {
        var pingCache = root2.pingCache;
        null !== pingCache && pingCache.delete(wakeable);
        root2.pingedLanes |= root2.suspendedLanes & pingedLanes;
        root2.warmLanes &= ~pingedLanes;
        workInProgressRoot === root2 && (workInProgressRootRenderLanes & pingedLanes) === pingedLanes && (4 === workInProgressRootExitStatus || 3 === workInProgressRootExitStatus && (workInProgressRootRenderLanes & 62914560) === workInProgressRootRenderLanes && 300 > now() - globalMostRecentFallbackTime ? 0 === (executionContext & 2) ? prepareFreshStack(root2, 0) : workInProgressRootPingedLanes |= pingedLanes : workInProgressRootPingedLanes |= pingedLanes, workInProgressSuspendedRetryLanes === workInProgressRootRenderLanes && (workInProgressSuspendedRetryLanes = 0));
        ensureRootIsScheduled(root2);
      }
      function retryTimedOutBoundary(boundaryFiber, retryLane) {
        0 === retryLane && (retryLane = claimNextRetryLane());
        boundaryFiber = enqueueConcurrentRenderForLane(boundaryFiber, retryLane);
        null !== boundaryFiber && (markRootUpdated$1(boundaryFiber, retryLane), ensureRootIsScheduled(boundaryFiber));
      }
      function retryDehydratedSuspenseBoundary(boundaryFiber) {
        var suspenseState = boundaryFiber.memoizedState, retryLane = 0;
        null !== suspenseState && (retryLane = suspenseState.retryLane);
        retryTimedOutBoundary(boundaryFiber, retryLane);
      }
      function resolveRetryWakeable(boundaryFiber, wakeable) {
        var retryLane = 0;
        switch (boundaryFiber.tag) {
          case 31:
          case 13:
            var retryCache = boundaryFiber.stateNode;
            var suspenseState = boundaryFiber.memoizedState;
            null !== suspenseState && (retryLane = suspenseState.retryLane);
            break;
          case 19:
            retryCache = boundaryFiber.stateNode;
            break;
          case 22:
            retryCache = boundaryFiber.stateNode._retryCache;
            break;
          default:
            throw Error(formatProdErrorMessage(314));
        }
        null !== retryCache && retryCache.delete(wakeable);
        retryTimedOutBoundary(boundaryFiber, retryLane);
      }
      function scheduleCallback$1(priorityLevel, callback) {
        return scheduleCallback$3(priorityLevel, callback);
      }
      var firstScheduledRoot = null;
      var lastScheduledRoot = null;
      var didScheduleMicrotask = false;
      var mightHavePendingSyncWork = false;
      var isFlushingWork = false;
      var currentEventTransitionLane = 0;
      function ensureRootIsScheduled(root2) {
        root2 !== lastScheduledRoot && null === root2.next && (null === lastScheduledRoot ? firstScheduledRoot = lastScheduledRoot = root2 : lastScheduledRoot = lastScheduledRoot.next = root2);
        mightHavePendingSyncWork = true;
        didScheduleMicrotask || (didScheduleMicrotask = true, scheduleImmediateRootScheduleTask());
      }
      function flushSyncWorkAcrossRoots_impl(syncTransitionLanes, onlyLegacy) {
        if (!isFlushingWork && mightHavePendingSyncWork) {
          isFlushingWork = true;
          do {
            var didPerformSomeWork = false;
            for (var root$190 = firstScheduledRoot; null !== root$190; ) {
              if (!onlyLegacy)
                if (0 !== syncTransitionLanes) {
                  var pendingLanes = root$190.pendingLanes;
                  if (0 === pendingLanes) var JSCompiler_inline_result = 0;
                  else {
                    var suspendedLanes = root$190.suspendedLanes, pingedLanes = root$190.pingedLanes;
                    JSCompiler_inline_result = (1 << 31 - clz32(42 | syncTransitionLanes) + 1) - 1;
                    JSCompiler_inline_result &= pendingLanes & ~(suspendedLanes & ~pingedLanes);
                    JSCompiler_inline_result = JSCompiler_inline_result & 201326741 ? JSCompiler_inline_result & 201326741 | 1 : JSCompiler_inline_result ? JSCompiler_inline_result | 2 : 0;
                  }
                  0 !== JSCompiler_inline_result && (didPerformSomeWork = true, performSyncWorkOnRoot(root$190, JSCompiler_inline_result));
                } else
                  JSCompiler_inline_result = workInProgressRootRenderLanes, JSCompiler_inline_result = getNextLanes(
                    root$190,
                    root$190 === workInProgressRoot ? JSCompiler_inline_result : 0,
                    null !== root$190.cancelPendingCommit || -1 !== root$190.timeoutHandle
                  ), 0 === (JSCompiler_inline_result & 3) || checkIfRootIsPrerendering(root$190, JSCompiler_inline_result) || (didPerformSomeWork = true, performSyncWorkOnRoot(root$190, JSCompiler_inline_result));
              root$190 = root$190.next;
            }
          } while (didPerformSomeWork);
          isFlushingWork = false;
        }
      }
      function processRootScheduleInImmediateTask() {
        processRootScheduleInMicrotask();
      }
      function processRootScheduleInMicrotask() {
        mightHavePendingSyncWork = didScheduleMicrotask = false;
        var syncTransitionLanes = 0;
        0 !== currentEventTransitionLane && shouldAttemptEagerTransition() && (syncTransitionLanes = currentEventTransitionLane);
        for (var currentTime = now(), prev = null, root2 = firstScheduledRoot; null !== root2; ) {
          var next = root2.next, nextLanes = scheduleTaskForRootDuringMicrotask(root2, currentTime);
          if (0 === nextLanes)
            root2.next = null, null === prev ? firstScheduledRoot = next : prev.next = next, null === next && (lastScheduledRoot = prev);
          else if (prev = root2, 0 !== syncTransitionLanes || 0 !== (nextLanes & 3))
            mightHavePendingSyncWork = true;
          root2 = next;
        }
        0 !== pendingEffectsStatus && 5 !== pendingEffectsStatus || flushSyncWorkAcrossRoots_impl(syncTransitionLanes, false);
        0 !== currentEventTransitionLane && (currentEventTransitionLane = 0);
      }
      function scheduleTaskForRootDuringMicrotask(root2, currentTime) {
        for (var suspendedLanes = root2.suspendedLanes, pingedLanes = root2.pingedLanes, expirationTimes = root2.expirationTimes, lanes = root2.pendingLanes & -62914561; 0 < lanes; ) {
          var index$5 = 31 - clz32(lanes), lane = 1 << index$5, expirationTime = expirationTimes[index$5];
          if (-1 === expirationTime) {
            if (0 === (lane & suspendedLanes) || 0 !== (lane & pingedLanes))
              expirationTimes[index$5] = computeExpirationTime(lane, currentTime);
          } else expirationTime <= currentTime && (root2.expiredLanes |= lane);
          lanes &= ~lane;
        }
        currentTime = workInProgressRoot;
        suspendedLanes = workInProgressRootRenderLanes;
        suspendedLanes = getNextLanes(
          root2,
          root2 === currentTime ? suspendedLanes : 0,
          null !== root2.cancelPendingCommit || -1 !== root2.timeoutHandle
        );
        pingedLanes = root2.callbackNode;
        if (0 === suspendedLanes || root2 === currentTime && (2 === workInProgressSuspendedReason || 9 === workInProgressSuspendedReason) || null !== root2.cancelPendingCommit)
          return null !== pingedLanes && null !== pingedLanes && cancelCallback$1(pingedLanes), root2.callbackNode = null, root2.callbackPriority = 0;
        if (0 === (suspendedLanes & 3) || checkIfRootIsPrerendering(root2, suspendedLanes)) {
          currentTime = suspendedLanes & -suspendedLanes;
          if (currentTime === root2.callbackPriority) return currentTime;
          null !== pingedLanes && cancelCallback$1(pingedLanes);
          switch (lanesToEventPriority(suspendedLanes)) {
            case 2:
            case 8:
              suspendedLanes = UserBlockingPriority;
              break;
            case 32:
              suspendedLanes = NormalPriority$1;
              break;
            case 268435456:
              suspendedLanes = IdlePriority;
              break;
            default:
              suspendedLanes = NormalPriority$1;
          }
          pingedLanes = performWorkOnRootViaSchedulerTask.bind(null, root2);
          suspendedLanes = scheduleCallback$3(suspendedLanes, pingedLanes);
          root2.callbackPriority = currentTime;
          root2.callbackNode = suspendedLanes;
          return currentTime;
        }
        null !== pingedLanes && null !== pingedLanes && cancelCallback$1(pingedLanes);
        root2.callbackPriority = 2;
        root2.callbackNode = null;
        return 2;
      }
      function performWorkOnRootViaSchedulerTask(root2, didTimeout) {
        if (0 !== pendingEffectsStatus && 5 !== pendingEffectsStatus)
          return root2.callbackNode = null, root2.callbackPriority = 0, null;
        var originalCallbackNode = root2.callbackNode;
        if (flushPendingEffects() && root2.callbackNode !== originalCallbackNode)
          return null;
        var workInProgressRootRenderLanes$jscomp$0 = workInProgressRootRenderLanes;
        workInProgressRootRenderLanes$jscomp$0 = getNextLanes(
          root2,
          root2 === workInProgressRoot ? workInProgressRootRenderLanes$jscomp$0 : 0,
          null !== root2.cancelPendingCommit || -1 !== root2.timeoutHandle
        );
        if (0 === workInProgressRootRenderLanes$jscomp$0) return null;
        performWorkOnRoot(root2, workInProgressRootRenderLanes$jscomp$0, didTimeout);
        scheduleTaskForRootDuringMicrotask(root2, now());
        return null != root2.callbackNode && root2.callbackNode === originalCallbackNode ? performWorkOnRootViaSchedulerTask.bind(null, root2) : null;
      }
      function performSyncWorkOnRoot(root2, lanes) {
        if (flushPendingEffects()) return null;
        performWorkOnRoot(root2, lanes, true);
      }
      function scheduleImmediateRootScheduleTask() {
        scheduleMicrotask(function() {
          0 !== (executionContext & 6) ? scheduleCallback$3(
            ImmediatePriority,
            processRootScheduleInImmediateTask
          ) : processRootScheduleInMicrotask();
        });
      }
      function requestTransitionLane() {
        if (0 === currentEventTransitionLane) {
          var actionScopeLane = currentEntangledLane;
          0 === actionScopeLane && (actionScopeLane = nextTransitionUpdateLane, nextTransitionUpdateLane <<= 1, 0 === (nextTransitionUpdateLane & 261888) && (nextTransitionUpdateLane = 256));
          currentEventTransitionLane = actionScopeLane;
        }
        return currentEventTransitionLane;
      }
      function coerceFormActionProp(actionProp) {
        return null == actionProp || "symbol" === typeof actionProp || "boolean" === typeof actionProp ? null : "function" === typeof actionProp ? actionProp : sanitizeURL(actionProp);
      }
      function extractEvents$1(dispatchQueue, domEventName, maybeTargetInst, nativeEvent, nativeEventTarget) {
        if ("submit" === domEventName && maybeTargetInst && maybeTargetInst.stateNode === nativeEventTarget) {
          var action = coerceFormActionProp(
            (nativeEventTarget[internalPropsKey] || null).action
          ), submitter = nativeEvent.submitter;
          submitter && (domEventName = (domEventName = submitter[internalPropsKey] || null) ? coerceFormActionProp(domEventName.formAction) : submitter.getAttribute("formAction"), null !== domEventName && (action = domEventName, submitter = null));
          var event = new SyntheticEvent(
            "action",
            "action",
            null,
            nativeEvent,
            nativeEventTarget
          );
          dispatchQueue.push({
            event,
            listeners: [
              {
                instance: null,
                listener: function() {
                  if (nativeEvent.defaultPrevented) {
                    if (0 !== currentEventTransitionLane) {
                      var formData = new FormData(nativeEventTarget, submitter);
                      startHostTransition(
                        maybeTargetInst,
                        {
                          pending: true,
                          data: formData,
                          method: nativeEventTarget.method,
                          action
                        },
                        null,
                        formData
                      );
                    }
                  } else
                    "function" === typeof action && (event.preventDefault(), formData = new FormData(nativeEventTarget, submitter), startHostTransition(
                      maybeTargetInst,
                      {
                        pending: true,
                        data: formData,
                        method: nativeEventTarget.method,
                        action
                      },
                      action,
                      formData
                    ));
                },
                currentTarget: nativeEventTarget
              }
            ]
          });
        }
      }
      for (i$jscomp$inline_1667 = 0; i$jscomp$inline_1667 < simpleEventPluginEvents.length; i$jscomp$inline_1667++) {
        eventName$jscomp$inline_1668 = simpleEventPluginEvents[i$jscomp$inline_1667], domEventName$jscomp$inline_1669 = eventName$jscomp$inline_1668.toLowerCase(), capitalizedEvent$jscomp$inline_1670 = eventName$jscomp$inline_1668[0].toUpperCase() + eventName$jscomp$inline_1668.slice(1);
        registerSimpleEvent(
          domEventName$jscomp$inline_1669,
          "on" + capitalizedEvent$jscomp$inline_1670
        );
      }
      var eventName$jscomp$inline_1668;
      var domEventName$jscomp$inline_1669;
      var capitalizedEvent$jscomp$inline_1670;
      var i$jscomp$inline_1667;
      registerSimpleEvent(ANIMATION_END, "onAnimationEnd");
      registerSimpleEvent(ANIMATION_ITERATION, "onAnimationIteration");
      registerSimpleEvent(ANIMATION_START, "onAnimationStart");
      registerSimpleEvent("dblclick", "onDoubleClick");
      registerSimpleEvent("focusin", "onFocus");
      registerSimpleEvent("focusout", "onBlur");
      registerSimpleEvent(TRANSITION_RUN, "onTransitionRun");
      registerSimpleEvent(TRANSITION_START, "onTransitionStart");
      registerSimpleEvent(TRANSITION_CANCEL, "onTransitionCancel");
      registerSimpleEvent(TRANSITION_END, "onTransitionEnd");
      registerDirectEvent("onMouseEnter", ["mouseout", "mouseover"]);
      registerDirectEvent("onMouseLeave", ["mouseout", "mouseover"]);
      registerDirectEvent("onPointerEnter", ["pointerout", "pointerover"]);
      registerDirectEvent("onPointerLeave", ["pointerout", "pointerover"]);
      registerTwoPhaseEvent(
        "onChange",
        "change click focusin focusout input keydown keyup selectionchange".split(" ")
      );
      registerTwoPhaseEvent(
        "onSelect",
        "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
          " "
        )
      );
      registerTwoPhaseEvent("onBeforeInput", [
        "compositionend",
        "keypress",
        "textInput",
        "paste"
      ]);
      registerTwoPhaseEvent(
        "onCompositionEnd",
        "compositionend focusout keydown keypress keyup mousedown".split(" ")
      );
      registerTwoPhaseEvent(
        "onCompositionStart",
        "compositionstart focusout keydown keypress keyup mousedown".split(" ")
      );
      registerTwoPhaseEvent(
        "onCompositionUpdate",
        "compositionupdate focusout keydown keypress keyup mousedown".split(" ")
      );
      var mediaEventTypes = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
        " "
      );
      var nonDelegatedEvents = new Set(
        "beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(mediaEventTypes)
      );
      function processDispatchQueue(dispatchQueue, eventSystemFlags) {
        eventSystemFlags = 0 !== (eventSystemFlags & 4);
        for (var i = 0; i < dispatchQueue.length; i++) {
          var _dispatchQueue$i = dispatchQueue[i], event = _dispatchQueue$i.event;
          _dispatchQueue$i = _dispatchQueue$i.listeners;
          a: {
            var previousInstance = void 0;
            if (eventSystemFlags)
              for (var i$jscomp$0 = _dispatchQueue$i.length - 1; 0 <= i$jscomp$0; i$jscomp$0--) {
                var _dispatchListeners$i = _dispatchQueue$i[i$jscomp$0], instance = _dispatchListeners$i.instance, currentTarget = _dispatchListeners$i.currentTarget;
                _dispatchListeners$i = _dispatchListeners$i.listener;
                if (instance !== previousInstance && event.isPropagationStopped())
                  break a;
                previousInstance = _dispatchListeners$i;
                event.currentTarget = currentTarget;
                try {
                  previousInstance(event);
                } catch (error) {
                  reportGlobalError(error);
                }
                event.currentTarget = null;
                previousInstance = instance;
              }
            else
              for (i$jscomp$0 = 0; i$jscomp$0 < _dispatchQueue$i.length; i$jscomp$0++) {
                _dispatchListeners$i = _dispatchQueue$i[i$jscomp$0];
                instance = _dispatchListeners$i.instance;
                currentTarget = _dispatchListeners$i.currentTarget;
                _dispatchListeners$i = _dispatchListeners$i.listener;
                if (instance !== previousInstance && event.isPropagationStopped())
                  break a;
                previousInstance = _dispatchListeners$i;
                event.currentTarget = currentTarget;
                try {
                  previousInstance(event);
                } catch (error) {
                  reportGlobalError(error);
                }
                event.currentTarget = null;
                previousInstance = instance;
              }
          }
        }
      }
      function listenToNonDelegatedEvent(domEventName, targetElement) {
        var JSCompiler_inline_result = targetElement[internalEventHandlersKey];
        void 0 === JSCompiler_inline_result && (JSCompiler_inline_result = targetElement[internalEventHandlersKey] = /* @__PURE__ */ new Set());
        var listenerSetKey = domEventName + "__bubble";
        JSCompiler_inline_result.has(listenerSetKey) || (addTrappedEventListener(targetElement, domEventName, 2, false), JSCompiler_inline_result.add(listenerSetKey));
      }
      function listenToNativeEvent(domEventName, isCapturePhaseListener, target) {
        var eventSystemFlags = 0;
        isCapturePhaseListener && (eventSystemFlags |= 4);
        addTrappedEventListener(
          target,
          domEventName,
          eventSystemFlags,
          isCapturePhaseListener
        );
      }
      var listeningMarker = "_reactListening" + Math.random().toString(36).slice(2);
      function listenToAllSupportedEvents(rootContainerElement) {
        if (!rootContainerElement[listeningMarker]) {
          rootContainerElement[listeningMarker] = true;
          allNativeEvents.forEach(function(domEventName) {
            "selectionchange" !== domEventName && (nonDelegatedEvents.has(domEventName) || listenToNativeEvent(domEventName, false, rootContainerElement), listenToNativeEvent(domEventName, true, rootContainerElement));
          });
          var ownerDocument = 9 === rootContainerElement.nodeType ? rootContainerElement : rootContainerElement.ownerDocument;
          null === ownerDocument || ownerDocument[listeningMarker] || (ownerDocument[listeningMarker] = true, listenToNativeEvent("selectionchange", false, ownerDocument));
        }
      }
      function addTrappedEventListener(targetContainer, domEventName, eventSystemFlags, isCapturePhaseListener) {
        switch (getEventPriority(domEventName)) {
          case 2:
            var listenerWrapper = dispatchDiscreteEvent;
            break;
          case 8:
            listenerWrapper = dispatchContinuousEvent;
            break;
          default:
            listenerWrapper = dispatchEvent;
        }
        eventSystemFlags = listenerWrapper.bind(
          null,
          domEventName,
          eventSystemFlags,
          targetContainer
        );
        listenerWrapper = void 0;
        !passiveBrowserEventsSupported || "touchstart" !== domEventName && "touchmove" !== domEventName && "wheel" !== domEventName || (listenerWrapper = true);
        isCapturePhaseListener ? void 0 !== listenerWrapper ? targetContainer.addEventListener(domEventName, eventSystemFlags, {
          capture: true,
          passive: listenerWrapper
        }) : targetContainer.addEventListener(domEventName, eventSystemFlags, true) : void 0 !== listenerWrapper ? targetContainer.addEventListener(domEventName, eventSystemFlags, {
          passive: listenerWrapper
        }) : targetContainer.addEventListener(domEventName, eventSystemFlags, false);
      }
      function dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, targetInst$jscomp$0, targetContainer) {
        var ancestorInst = targetInst$jscomp$0;
        if (0 === (eventSystemFlags & 1) && 0 === (eventSystemFlags & 2) && null !== targetInst$jscomp$0)
          a: for (; ; ) {
            if (null === targetInst$jscomp$0) return;
            var nodeTag = targetInst$jscomp$0.tag;
            if (3 === nodeTag || 4 === nodeTag) {
              var container = targetInst$jscomp$0.stateNode.containerInfo;
              if (container === targetContainer) break;
              if (4 === nodeTag)
                for (nodeTag = targetInst$jscomp$0.return; null !== nodeTag; ) {
                  var grandTag = nodeTag.tag;
                  if ((3 === grandTag || 4 === grandTag) && nodeTag.stateNode.containerInfo === targetContainer)
                    return;
                  nodeTag = nodeTag.return;
                }
              for (; null !== container; ) {
                nodeTag = getClosestInstanceFromNode(container);
                if (null === nodeTag) return;
                grandTag = nodeTag.tag;
                if (5 === grandTag || 6 === grandTag || 26 === grandTag || 27 === grandTag) {
                  targetInst$jscomp$0 = ancestorInst = nodeTag;
                  continue a;
                }
                container = container.parentNode;
              }
            }
            targetInst$jscomp$0 = targetInst$jscomp$0.return;
          }
        batchedUpdates$1(function() {
          var targetInst = ancestorInst, nativeEventTarget = getEventTarget(nativeEvent), dispatchQueue = [];
          a: {
            var reactName = topLevelEventsToReactNames.get(domEventName);
            if (void 0 !== reactName) {
              var SyntheticEventCtor = SyntheticEvent, reactEventType = domEventName;
              switch (domEventName) {
                case "keypress":
                  if (0 === getEventCharCode(nativeEvent)) break a;
                case "keydown":
                case "keyup":
                  SyntheticEventCtor = SyntheticKeyboardEvent;
                  break;
                case "focusin":
                  reactEventType = "focus";
                  SyntheticEventCtor = SyntheticFocusEvent;
                  break;
                case "focusout":
                  reactEventType = "blur";
                  SyntheticEventCtor = SyntheticFocusEvent;
                  break;
                case "beforeblur":
                case "afterblur":
                  SyntheticEventCtor = SyntheticFocusEvent;
                  break;
                case "click":
                  if (2 === nativeEvent.button) break a;
                case "auxclick":
                case "dblclick":
                case "mousedown":
                case "mousemove":
                case "mouseup":
                case "mouseout":
                case "mouseover":
                case "contextmenu":
                  SyntheticEventCtor = SyntheticMouseEvent;
                  break;
                case "drag":
                case "dragend":
                case "dragenter":
                case "dragexit":
                case "dragleave":
                case "dragover":
                case "dragstart":
                case "drop":
                  SyntheticEventCtor = SyntheticDragEvent;
                  break;
                case "touchcancel":
                case "touchend":
                case "touchmove":
                case "touchstart":
                  SyntheticEventCtor = SyntheticTouchEvent;
                  break;
                case ANIMATION_END:
                case ANIMATION_ITERATION:
                case ANIMATION_START:
                  SyntheticEventCtor = SyntheticAnimationEvent;
                  break;
                case TRANSITION_END:
                  SyntheticEventCtor = SyntheticTransitionEvent;
                  break;
                case "scroll":
                case "scrollend":
                  SyntheticEventCtor = SyntheticUIEvent;
                  break;
                case "wheel":
                  SyntheticEventCtor = SyntheticWheelEvent;
                  break;
                case "copy":
                case "cut":
                case "paste":
                  SyntheticEventCtor = SyntheticClipboardEvent;
                  break;
                case "gotpointercapture":
                case "lostpointercapture":
                case "pointercancel":
                case "pointerdown":
                case "pointermove":
                case "pointerout":
                case "pointerover":
                case "pointerup":
                  SyntheticEventCtor = SyntheticPointerEvent;
                  break;
                case "submit":
                  SyntheticEventCtor = SyntheticSubmitEvent;
                  break;
                case "toggle":
                case "beforetoggle":
                  SyntheticEventCtor = SyntheticToggleEvent;
              }
              var inCapturePhase = 0 !== (eventSystemFlags & 4), accumulateTargetOnly = !inCapturePhase && ("scroll" === domEventName || "scrollend" === domEventName), reactEventName = inCapturePhase ? null !== reactName ? reactName + "Capture" : null : reactName;
              inCapturePhase = [];
              for (var instance = targetInst, lastHostComponent; null !== instance; ) {
                var _instance = instance;
                lastHostComponent = _instance.stateNode;
                _instance = _instance.tag;
                5 !== _instance && 26 !== _instance && 27 !== _instance || null === lastHostComponent || null === reactEventName || (_instance = getListener(instance, reactEventName), null != _instance && inCapturePhase.push(
                  createDispatchListener(instance, _instance, lastHostComponent)
                ));
                if (accumulateTargetOnly) break;
                instance = instance.return;
              }
              0 < inCapturePhase.length && (reactName = new SyntheticEventCtor(
                reactName,
                reactEventType,
                null,
                nativeEvent,
                nativeEventTarget
              ), dispatchQueue.push({ event: reactName, listeners: inCapturePhase }));
            }
          }
          if (0 === (eventSystemFlags & 7)) {
            a: {
              SyntheticEventCtor = "mouseover" === domEventName || "pointerover" === domEventName;
              reactName = "mouseout" === domEventName || "pointerout" === domEventName;
              if (SyntheticEventCtor && nativeEvent !== currentReplayingEvent && (reactEventType = nativeEvent.relatedTarget || nativeEvent.fromElement) && (getClosestInstanceFromNode(reactEventType) || reactEventType[internalContainerInstanceKey]))
                break a;
              if (reactName || SyntheticEventCtor) {
                reactEventType = nativeEventTarget.window === nativeEventTarget ? nativeEventTarget : (SyntheticEventCtor = nativeEventTarget.ownerDocument) ? SyntheticEventCtor.defaultView || SyntheticEventCtor.parentWindow : window;
                if (reactName) {
                  if (SyntheticEventCtor = nativeEvent.relatedTarget || nativeEvent.toElement, reactName = targetInst, SyntheticEventCtor = SyntheticEventCtor ? getClosestInstanceFromNode(SyntheticEventCtor) : null, null !== SyntheticEventCtor && (accumulateTargetOnly = getNearestMountedFiber(SyntheticEventCtor), inCapturePhase = SyntheticEventCtor.tag, SyntheticEventCtor !== accumulateTargetOnly || 5 !== inCapturePhase && 27 !== inCapturePhase && 6 !== inCapturePhase))
                    SyntheticEventCtor = null;
                } else reactName = null, SyntheticEventCtor = targetInst;
                if (reactName !== SyntheticEventCtor) {
                  inCapturePhase = SyntheticMouseEvent;
                  _instance = "onMouseLeave";
                  reactEventName = "onMouseEnter";
                  instance = "mouse";
                  if ("pointerout" === domEventName || "pointerover" === domEventName)
                    inCapturePhase = SyntheticPointerEvent, _instance = "onPointerLeave", reactEventName = "onPointerEnter", instance = "pointer";
                  accumulateTargetOnly = null == reactName ? reactEventType : getNodeFromInstance(reactName);
                  lastHostComponent = null == SyntheticEventCtor ? reactEventType : getNodeFromInstance(SyntheticEventCtor);
                  reactEventType = new inCapturePhase(
                    _instance,
                    instance + "leave",
                    reactName,
                    nativeEvent,
                    nativeEventTarget
                  );
                  reactEventType.target = accumulateTargetOnly;
                  reactEventType.relatedTarget = lastHostComponent;
                  _instance = null;
                  getClosestInstanceFromNode(nativeEventTarget) === targetInst && (inCapturePhase = new inCapturePhase(
                    reactEventName,
                    instance + "enter",
                    SyntheticEventCtor,
                    nativeEvent,
                    nativeEventTarget
                  ), inCapturePhase.target = lastHostComponent, inCapturePhase.relatedTarget = accumulateTargetOnly, _instance = inCapturePhase);
                  accumulateTargetOnly = _instance;
                  inCapturePhase = reactName && SyntheticEventCtor ? getLowestCommonAncestor(
                    reactName,
                    SyntheticEventCtor,
                    getParent
                  ) : null;
                  null !== reactName && accumulateEnterLeaveListenersForEvent(
                    dispatchQueue,
                    reactEventType,
                    reactName,
                    inCapturePhase,
                    false
                  );
                  null !== SyntheticEventCtor && null !== accumulateTargetOnly && accumulateEnterLeaveListenersForEvent(
                    dispatchQueue,
                    accumulateTargetOnly,
                    SyntheticEventCtor,
                    inCapturePhase,
                    true
                  );
                }
              }
            }
            a: {
              reactName = targetInst ? getNodeFromInstance(targetInst) : window;
              SyntheticEventCtor = reactName.nodeName && reactName.nodeName.toLowerCase();
              if ("select" === SyntheticEventCtor || "input" === SyntheticEventCtor && "file" === reactName.type)
                var getTargetInstFunc = getTargetInstForChangeEvent;
              else if (isTextInputElement(reactName))
                if (isInputEventSupported)
                  getTargetInstFunc = getTargetInstForInputOrChangeEvent;
                else {
                  getTargetInstFunc = getTargetInstForInputEventPolyfill;
                  var handleEventFunc = handleEventsForInputEventPolyfill;
                }
              else
                SyntheticEventCtor = reactName.nodeName, !SyntheticEventCtor || "input" !== SyntheticEventCtor.toLowerCase() || "checkbox" !== reactName.type && "radio" !== reactName.type ? targetInst && isCustomElement(targetInst.elementType) && (getTargetInstFunc = getTargetInstForChangeEvent) : getTargetInstFunc = getTargetInstForClickEvent;
              if (getTargetInstFunc && (getTargetInstFunc = getTargetInstFunc(domEventName, targetInst))) {
                createAndAccumulateChangeEvent(
                  dispatchQueue,
                  getTargetInstFunc,
                  nativeEvent,
                  nativeEventTarget
                );
                break a;
              }
              handleEventFunc && handleEventFunc(domEventName, reactName, targetInst);
            }
            handleEventFunc = targetInst ? getNodeFromInstance(targetInst) : window;
            switch (domEventName) {
              case "focusin":
                if (isTextInputElement(handleEventFunc) || "true" === handleEventFunc.contentEditable)
                  activeElement = handleEventFunc, activeElementInst = targetInst, lastSelection = null;
                break;
              case "focusout":
                lastSelection = activeElementInst = activeElement = null;
                break;
              case "mousedown":
                mouseDown = true;
                break;
              case "contextmenu":
              case "mouseup":
              case "dragend":
                mouseDown = false;
                constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
                break;
              case "selectionchange":
                if (skipSelectionChangeEvent) break;
              case "keydown":
              case "keyup":
                constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
            }
            var fallbackData;
            if (canUseCompositionEvent)
              b: {
                switch (domEventName) {
                  case "compositionstart":
                    var eventType = "onCompositionStart";
                    break b;
                  case "compositionend":
                    eventType = "onCompositionEnd";
                    break b;
                  case "compositionupdate":
                    eventType = "onCompositionUpdate";
                    break b;
                }
                eventType = void 0;
              }
            else
              isComposing ? isFallbackCompositionEnd(domEventName, nativeEvent) && (eventType = "onCompositionEnd") : "keydown" === domEventName && 229 === nativeEvent.keyCode && (eventType = "onCompositionStart");
            eventType && (useFallbackCompositionData && "ko" !== nativeEvent.locale && (isComposing || "onCompositionStart" !== eventType ? "onCompositionEnd" === eventType && isComposing && (fallbackData = getData()) : (root = nativeEventTarget, startText = "value" in root ? root.value : root.textContent, isComposing = true)), handleEventFunc = accumulateTwoPhaseListeners(targetInst, eventType), 0 < handleEventFunc.length && (eventType = new SyntheticCompositionEvent(
              eventType,
              domEventName,
              null,
              nativeEvent,
              nativeEventTarget
            ), dispatchQueue.push({ event: eventType, listeners: handleEventFunc }), fallbackData ? eventType.data = fallbackData : (fallbackData = getDataFromCustomEvent(nativeEvent), null !== fallbackData && (eventType.data = fallbackData))));
            if (fallbackData = canUseTextInputEvent ? getNativeBeforeInputChars(domEventName, nativeEvent) : getFallbackBeforeInputChars(domEventName, nativeEvent))
              eventType = accumulateTwoPhaseListeners(targetInst, "onBeforeInput"), 0 < eventType.length && (handleEventFunc = new SyntheticCompositionEvent(
                "onBeforeInput",
                "beforeinput",
                null,
                nativeEvent,
                nativeEventTarget
              ), dispatchQueue.push({
                event: handleEventFunc,
                listeners: eventType
              }), handleEventFunc.data = fallbackData);
            extractEvents$1(
              dispatchQueue,
              domEventName,
              targetInst,
              nativeEvent,
              nativeEventTarget
            );
          }
          processDispatchQueue(dispatchQueue, eventSystemFlags);
        });
      }
      function createDispatchListener(instance, listener, currentTarget) {
        return {
          instance,
          listener,
          currentTarget
        };
      }
      function accumulateTwoPhaseListeners(targetFiber, reactName) {
        for (var captureName = reactName + "Capture", listeners = []; null !== targetFiber; ) {
          var _instance2 = targetFiber, stateNode = _instance2.stateNode;
          _instance2 = _instance2.tag;
          5 !== _instance2 && 26 !== _instance2 && 27 !== _instance2 || null === stateNode || (_instance2 = getListener(targetFiber, captureName), null != _instance2 && listeners.unshift(
            createDispatchListener(targetFiber, _instance2, stateNode)
          ), _instance2 = getListener(targetFiber, reactName), null != _instance2 && listeners.push(
            createDispatchListener(targetFiber, _instance2, stateNode)
          ));
          if (3 === targetFiber.tag) return listeners;
          targetFiber = targetFiber.return;
        }
        return [];
      }
      function getParent(inst) {
        if (null === inst) return null;
        do
          inst = inst.return;
        while (inst && 5 !== inst.tag && 27 !== inst.tag);
        return inst ? inst : null;
      }
      function accumulateEnterLeaveListenersForEvent(dispatchQueue, event, target, common, inCapturePhase) {
        for (var registrationName = event._reactName, listeners = []; null !== target && target !== common; ) {
          var _instance3 = target, alternate = _instance3.alternate, stateNode = _instance3.stateNode;
          _instance3 = _instance3.tag;
          if (null !== alternate && alternate === common) break;
          5 !== _instance3 && 26 !== _instance3 && 27 !== _instance3 || null === stateNode || (alternate = stateNode, inCapturePhase ? (stateNode = getListener(target, registrationName), null != stateNode && listeners.unshift(
            createDispatchListener(target, stateNode, alternate)
          )) : inCapturePhase || (stateNode = getListener(target, registrationName), null != stateNode && listeners.push(
            createDispatchListener(target, stateNode, alternate)
          )));
          target = target.return;
        }
        0 !== listeners.length && dispatchQueue.push({ event, listeners });
      }
      var NORMALIZE_NEWLINES_REGEX = /\r\n?/g;
      var NORMALIZE_NULL_AND_REPLACEMENT_REGEX = /\u0000|\uFFFD/g;
      function normalizeMarkupForTextOrAttribute(markup) {
        return ("string" === typeof markup ? markup : "" + markup).replace(NORMALIZE_NEWLINES_REGEX, "\n").replace(NORMALIZE_NULL_AND_REPLACEMENT_REGEX, "");
      }
      function checkForUnmatchedText(serverText, clientText) {
        clientText = normalizeMarkupForTextOrAttribute(clientText);
        return normalizeMarkupForTextOrAttribute(serverText) === clientText ? true : false;
      }
      function setProp(domElement, tag, key, value, props, prevValue) {
        switch (key) {
          case "children":
            if ("string" === typeof value)
              "body" === tag || "textarea" === tag && "" === value || setTextContent(domElement, value);
            else if ("number" === typeof value || "bigint" === typeof value)
              "body" !== tag && setTextContent(domElement, "" + value);
            else return;
            break;
          case "className":
            setValueForKnownAttribute(domElement, "class", value);
            break;
          case "tabIndex":
            setValueForKnownAttribute(domElement, "tabindex", value);
            break;
          case "dir":
          case "role":
          case "viewBox":
          case "width":
          case "height":
            setValueForKnownAttribute(domElement, key, value);
            break;
          case "style":
            setValueForStyles(domElement, value, prevValue);
            return;
          case "data":
            if ("object" !== tag) {
              setValueForKnownAttribute(domElement, "data", value);
              break;
            }
          case "src":
          case "href":
            if ("" === value && ("a" !== tag || "href" !== key)) {
              domElement.removeAttribute(key);
              break;
            }
            if (null == value || "function" === typeof value || "symbol" === typeof value || "boolean" === typeof value) {
              domElement.removeAttribute(key);
              break;
            }
            value = sanitizeURL(value);
            domElement.setAttribute(key, value);
            break;
          case "action":
          case "formAction":
            if ("function" === typeof value) {
              domElement.setAttribute(
                key,
                "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
              );
              break;
            } else
              "function" === typeof prevValue && ("formAction" === key ? ("input" !== tag && setProp(domElement, tag, "name", props.name, props, null), setProp(
                domElement,
                tag,
                "formEncType",
                props.formEncType,
                props,
                null
              ), setProp(
                domElement,
                tag,
                "formMethod",
                props.formMethod,
                props,
                null
              ), setProp(
                domElement,
                tag,
                "formTarget",
                props.formTarget,
                props,
                null
              )) : (setProp(domElement, tag, "encType", props.encType, props, null), setProp(domElement, tag, "method", props.method, props, null), setProp(domElement, tag, "target", props.target, props, null)));
            if (null == value || "symbol" === typeof value || "boolean" === typeof value) {
              domElement.removeAttribute(key);
              break;
            }
            value = sanitizeURL(value);
            domElement.setAttribute(key, value);
            break;
          case "onClick":
            null != value && (domElement.onclick = noop$1);
            return;
          case "onScroll":
            null != value && listenToNonDelegatedEvent("scroll", domElement);
            return;
          case "onScrollEnd":
            null != value && listenToNonDelegatedEvent("scrollend", domElement);
            return;
          case "dangerouslySetInnerHTML":
            if (null != value) {
              if ("object" !== typeof value || !("__html" in value))
                throw Error(formatProdErrorMessage(61));
              key = value.__html;
              if (null != key) {
                if (null != props.children) throw Error(formatProdErrorMessage(60));
                (null != prevValue ? prevValue.__html : void 0) !== key && (domElement.innerHTML = key);
              }
            }
            break;
          case "multiple":
            domElement.multiple = value && "function" !== typeof value && "symbol" !== typeof value;
            break;
          case "muted":
            domElement.muted = value && "function" !== typeof value && "symbol" !== typeof value;
            break;
          case "suppressContentEditableWarning":
          case "suppressHydrationWarning":
          case "defaultValue":
          case "defaultChecked":
          case "innerHTML":
          case "ref":
            break;
          case "autoFocus":
            break;
          case "xlinkHref":
            if (null == value || "function" === typeof value || "boolean" === typeof value || "symbol" === typeof value) {
              domElement.removeAttribute("xlink:href");
              break;
            }
            key = sanitizeURL(value);
            domElement.setAttributeNS(
              "http://www.w3.org/1999/xlink",
              "xlink:href",
              key
            );
            break;
          case "contentEditable":
          case "spellCheck":
          case "draggable":
          case "value":
          case "autoReverse":
          case "externalResourcesRequired":
          case "focusable":
          case "preserveAlpha":
            null != value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, value) : domElement.removeAttribute(key);
            break;
          case "inert":
          case "allowFullScreen":
          case "async":
          case "autoPlay":
          case "controls":
          case "credentialless":
          case "default":
          case "defer":
          case "disabled":
          case "disablePictureInPicture":
          case "disableRemotePlayback":
          case "formNoValidate":
          case "hidden":
          case "loop":
          case "noModule":
          case "noValidate":
          case "open":
          case "playsInline":
          case "readOnly":
          case "required":
          case "reversed":
          case "scoped":
          case "seamless":
          case "itemScope":
            value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, "") : domElement.removeAttribute(key);
            break;
          case "capture":
          case "download":
            true === value ? domElement.setAttribute(key, "") : false !== value && null != value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, value) : domElement.removeAttribute(key);
            break;
          case "cols":
          case "rows":
          case "size":
          case "span":
            null != value && "function" !== typeof value && "symbol" !== typeof value && !isNaN(value) && 1 <= value ? domElement.setAttribute(key, value) : domElement.removeAttribute(key);
            break;
          case "rowSpan":
          case "start":
            null == value || "function" === typeof value || "symbol" === typeof value || isNaN(value) ? domElement.removeAttribute(key) : domElement.setAttribute(key, value);
            break;
          case "popover":
            listenToNonDelegatedEvent("beforetoggle", domElement);
            listenToNonDelegatedEvent("toggle", domElement);
            setValueForAttribute(domElement, "popover", value);
            break;
          case "xlinkActuate":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:actuate",
              value
            );
            break;
          case "xlinkArcrole":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:arcrole",
              value
            );
            break;
          case "xlinkRole":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:role",
              value
            );
            break;
          case "xlinkShow":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:show",
              value
            );
            break;
          case "xlinkTitle":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:title",
              value
            );
            break;
          case "xlinkType":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:type",
              value
            );
            break;
          case "xmlBase":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/XML/1998/namespace",
              "xml:base",
              value
            );
            break;
          case "xmlLang":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/XML/1998/namespace",
              "xml:lang",
              value
            );
            break;
          case "xmlSpace":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/XML/1998/namespace",
              "xml:space",
              value
            );
            break;
          case "is":
            setValueForAttribute(domElement, "is", value);
            break;
          case "innerText":
          case "textContent":
            return;
          default:
            if (!(2 < key.length) || "o" !== key[0] && "O" !== key[0] || "n" !== key[1] && "N" !== key[1])
              key = aliases.get(key) || key, setValueForAttribute(domElement, key, value);
            else return;
        }
        viewTransitionMutationContext = true;
      }
      function setPropOnCustomElement(domElement, tag, key, value, props, prevValue) {
        switch (key) {
          case "style":
            setValueForStyles(domElement, value, prevValue);
            return;
          case "dangerouslySetInnerHTML":
            if (null != value) {
              if ("object" !== typeof value || !("__html" in value))
                throw Error(formatProdErrorMessage(61));
              key = value.__html;
              if (null != key) {
                if (null != props.children) throw Error(formatProdErrorMessage(60));
                (null != prevValue ? prevValue.__html : void 0) !== key && (domElement.innerHTML = key);
              }
            }
            break;
          case "children":
            if ("string" === typeof value) setTextContent(domElement, value);
            else if ("number" === typeof value || "bigint" === typeof value)
              setTextContent(domElement, "" + value);
            else return;
            break;
          case "onScroll":
            null != value && listenToNonDelegatedEvent("scroll", domElement);
            return;
          case "onScrollEnd":
            null != value && listenToNonDelegatedEvent("scrollend", domElement);
            return;
          case "onClick":
            null != value && (domElement.onclick = noop$1);
            return;
          case "suppressContentEditableWarning":
          case "suppressHydrationWarning":
          case "innerHTML":
          case "ref":
            return;
          case "innerText":
          case "textContent":
            return;
          default:
            if (!registrationNameDependencies.hasOwnProperty(key))
              a: {
                if ("o" === key[0] && "n" === key[1] && (props = key.endsWith("Capture"), prevValue = key.slice(2, props ? key.length - 7 : void 0), tag = domElement[internalPropsKey] || null, tag = null != tag ? tag[key] : null, "function" === typeof tag && domElement.removeEventListener(prevValue, tag, props), "function" === typeof value)) {
                  "function" !== typeof tag && null !== tag && (key in domElement ? domElement[key] = null : domElement.hasAttribute(key) && domElement.removeAttribute(key));
                  domElement.addEventListener(prevValue, value, props);
                  break a;
                }
                viewTransitionMutationContext = true;
                key in domElement ? domElement[key] = value : true === value ? domElement.setAttribute(key, "") : setValueForAttribute(domElement, key, value);
              }
            return;
        }
        viewTransitionMutationContext = true;
      }
      function setInitialProperties(domElement, tag, props) {
        switch (tag) {
          case "div":
          case "span":
          case "svg":
          case "path":
          case "a":
          case "g":
          case "p":
          case "li":
            break;
          case "img":
            listenToNonDelegatedEvent("error", domElement);
            listenToNonDelegatedEvent("load", domElement);
            var hasSrc = false, hasSrcSet = false, propKey;
            for (propKey in props)
              if (props.hasOwnProperty(propKey)) {
                var propValue = props[propKey];
                if (null != propValue)
                  switch (propKey) {
                    case "src":
                      hasSrc = true;
                      break;
                    case "srcSet":
                      hasSrcSet = true;
                      break;
                    case "children":
                    case "dangerouslySetInnerHTML":
                      throw Error(formatProdErrorMessage(137, tag));
                    default:
                      setProp(domElement, tag, propKey, propValue, props, null);
                  }
              }
            hasSrcSet && setProp(domElement, tag, "srcSet", props.srcSet, props, null);
            hasSrc && setProp(domElement, tag, "src", props.src, props, null);
            return;
          case "input":
            listenToNonDelegatedEvent("invalid", domElement);
            var defaultValue = propKey = propValue = hasSrcSet = null, checked = null, defaultChecked = null;
            for (hasSrc in props)
              if (props.hasOwnProperty(hasSrc)) {
                var propValue$204 = props[hasSrc];
                if (null != propValue$204)
                  switch (hasSrc) {
                    case "name":
                      hasSrcSet = propValue$204;
                      break;
                    case "type":
                      propValue = propValue$204;
                      break;
                    case "checked":
                      checked = propValue$204;
                      break;
                    case "defaultChecked":
                      defaultChecked = propValue$204;
                      break;
                    case "value":
                      propKey = propValue$204;
                      break;
                    case "defaultValue":
                      defaultValue = propValue$204;
                      break;
                    case "children":
                    case "dangerouslySetInnerHTML":
                      if (null != propValue$204)
                        throw Error(formatProdErrorMessage(137, tag));
                      break;
                    default:
                      setProp(domElement, tag, hasSrc, propValue$204, props, null);
                  }
              }
            initInput(
              domElement,
              propKey,
              defaultValue,
              checked,
              defaultChecked,
              propValue,
              hasSrcSet,
              false
            );
            return;
          case "select":
            listenToNonDelegatedEvent("invalid", domElement);
            hasSrc = propValue = propKey = null;
            for (hasSrcSet in props)
              if (props.hasOwnProperty(hasSrcSet) && (defaultValue = props[hasSrcSet], null != defaultValue))
                switch (hasSrcSet) {
                  case "value":
                    propKey = defaultValue;
                    break;
                  case "defaultValue":
                    propValue = defaultValue;
                    break;
                  case "multiple":
                    hasSrc = defaultValue;
                  default:
                    setProp(domElement, tag, hasSrcSet, defaultValue, props, null);
                }
            tag = propKey;
            props = propValue;
            domElement.multiple = !!hasSrc;
            null != tag ? updateOptions(domElement, !!hasSrc, tag, false) : null != props && updateOptions(domElement, !!hasSrc, props, true);
            return;
          case "textarea":
            listenToNonDelegatedEvent("invalid", domElement);
            propKey = hasSrcSet = hasSrc = null;
            for (propValue in props)
              if (props.hasOwnProperty(propValue) && (defaultValue = props[propValue], null != defaultValue))
                switch (propValue) {
                  case "value":
                    hasSrc = defaultValue;
                    break;
                  case "defaultValue":
                    hasSrcSet = defaultValue;
                    break;
                  case "children":
                    propKey = defaultValue;
                    break;
                  case "dangerouslySetInnerHTML":
                    if (null != defaultValue) throw Error(formatProdErrorMessage(91));
                    break;
                  default:
                    setProp(domElement, tag, propValue, defaultValue, props, null);
                }
            initTextarea(domElement, hasSrc, hasSrcSet, propKey);
            return;
          case "option":
            for (checked in props)
              if (props.hasOwnProperty(checked) && (hasSrc = props[checked], null != hasSrc))
                switch (checked) {
                  case "selected":
                    domElement.selected = hasSrc && "function" !== typeof hasSrc && "symbol" !== typeof hasSrc;
                    break;
                  default:
                    setProp(domElement, tag, checked, hasSrc, props, null);
                }
            return;
          case "dialog":
            listenToNonDelegatedEvent("beforetoggle", domElement);
            listenToNonDelegatedEvent("toggle", domElement);
            listenToNonDelegatedEvent("cancel", domElement);
            listenToNonDelegatedEvent("close", domElement);
            break;
          case "iframe":
          case "object":
            listenToNonDelegatedEvent("load", domElement);
            break;
          case "video":
          case "audio":
            for (hasSrc = 0; hasSrc < mediaEventTypes.length; hasSrc++)
              listenToNonDelegatedEvent(mediaEventTypes[hasSrc], domElement);
            break;
          case "image":
            listenToNonDelegatedEvent("error", domElement);
            listenToNonDelegatedEvent("load", domElement);
            break;
          case "details":
            listenToNonDelegatedEvent("toggle", domElement);
            break;
          case "embed":
          case "source":
          case "link":
            listenToNonDelegatedEvent("error", domElement), listenToNonDelegatedEvent("load", domElement);
          case "area":
          case "base":
          case "br":
          case "col":
          case "hr":
          case "keygen":
          case "meta":
          case "param":
          case "track":
          case "wbr":
          case "menuitem":
            for (defaultChecked in props)
              if (props.hasOwnProperty(defaultChecked) && (hasSrc = props[defaultChecked], null != hasSrc))
                switch (defaultChecked) {
                  case "children":
                  case "dangerouslySetInnerHTML":
                    throw Error(formatProdErrorMessage(137, tag));
                  default:
                    setProp(domElement, tag, defaultChecked, hasSrc, props, null);
                }
            return;
          default:
            if (isCustomElement(tag)) {
              for (propValue$204 in props)
                props.hasOwnProperty(propValue$204) && (hasSrc = props[propValue$204], void 0 !== hasSrc && setPropOnCustomElement(
                  domElement,
                  tag,
                  propValue$204,
                  hasSrc,
                  props,
                  void 0
                ));
              return;
            }
        }
        for (defaultValue in props)
          props.hasOwnProperty(defaultValue) && (hasSrc = props[defaultValue], null != hasSrc && setProp(domElement, tag, defaultValue, hasSrc, props, null));
      }
      var emptyProps = {};
      function updateProperties(domElement, tag, lastProps, nextProps) {
        switch (tag) {
          case "div":
          case "span":
          case "svg":
          case "path":
          case "a":
          case "g":
          case "p":
          case "li":
            break;
          case "input":
            var name = null, type = null, value = null, defaultValue = null, lastDefaultValue = null, checked = null, defaultChecked = null;
            for (propKey in lastProps) {
              var lastProp = lastProps[propKey];
              if (lastProps.hasOwnProperty(propKey) && null != lastProp)
                switch (propKey) {
                  case "checked":
                    break;
                  case "value":
                    break;
                  case "defaultValue":
                    lastDefaultValue = lastProp;
                  default:
                    nextProps.hasOwnProperty(propKey) || setProp(domElement, tag, propKey, null, nextProps, lastProp);
                }
            }
            for (var propKey$221 in nextProps) {
              var propKey = nextProps[propKey$221];
              lastProp = lastProps[propKey$221];
              if (nextProps.hasOwnProperty(propKey$221) && (null != propKey || null != lastProp))
                switch (propKey$221) {
                  case "type":
                    propKey !== lastProp && (viewTransitionMutationContext = true);
                    type = propKey;
                    break;
                  case "name":
                    propKey !== lastProp && (viewTransitionMutationContext = true);
                    name = propKey;
                    break;
                  case "checked":
                    propKey !== lastProp && (viewTransitionMutationContext = true);
                    checked = propKey;
                    break;
                  case "defaultChecked":
                    propKey !== lastProp && (viewTransitionMutationContext = true);
                    defaultChecked = propKey;
                    break;
                  case "value":
                    propKey !== lastProp && (viewTransitionMutationContext = true);
                    value = propKey;
                    break;
                  case "defaultValue":
                    propKey !== lastProp && (viewTransitionMutationContext = true);
                    defaultValue = propKey;
                    break;
                  case "children":
                  case "dangerouslySetInnerHTML":
                    if (null != propKey)
                      throw Error(formatProdErrorMessage(137, tag));
                    break;
                  default:
                    propKey !== lastProp && setProp(
                      domElement,
                      tag,
                      propKey$221,
                      propKey,
                      nextProps,
                      lastProp
                    );
                }
            }
            updateInput(
              domElement,
              value,
              defaultValue,
              lastDefaultValue,
              checked,
              defaultChecked,
              type,
              name
            );
            return;
          case "select":
            propKey = value = defaultValue = propKey$221 = null;
            for (type in lastProps)
              if (lastDefaultValue = lastProps[type], lastProps.hasOwnProperty(type) && null != lastDefaultValue)
                switch (type) {
                  case "value":
                    break;
                  case "multiple":
                    propKey = lastDefaultValue;
                  default:
                    nextProps.hasOwnProperty(type) || setProp(
                      domElement,
                      tag,
                      type,
                      null,
                      nextProps,
                      lastDefaultValue
                    );
                }
            for (name in nextProps)
              if (type = nextProps[name], lastDefaultValue = lastProps[name], nextProps.hasOwnProperty(name) && (null != type || null != lastDefaultValue))
                switch (name) {
                  case "value":
                    type !== lastDefaultValue && (viewTransitionMutationContext = true);
                    propKey$221 = type;
                    break;
                  case "defaultValue":
                    type !== lastDefaultValue && (viewTransitionMutationContext = true);
                    defaultValue = type;
                    break;
                  case "multiple":
                    type !== lastDefaultValue && (viewTransitionMutationContext = true), value = type;
                  default:
                    type !== lastDefaultValue && setProp(
                      domElement,
                      tag,
                      name,
                      type,
                      nextProps,
                      lastDefaultValue
                    );
                }
            tag = defaultValue;
            lastProps = value;
            nextProps = propKey;
            null != propKey$221 ? updateOptions(domElement, !!lastProps, propKey$221, false) : !!nextProps !== !!lastProps && (null != tag ? updateOptions(domElement, !!lastProps, tag, true) : updateOptions(domElement, !!lastProps, lastProps ? [] : "", false));
            return;
          case "textarea":
            propKey = propKey$221 = null;
            for (defaultValue in lastProps)
              if (name = lastProps[defaultValue], lastProps.hasOwnProperty(defaultValue) && null != name && !nextProps.hasOwnProperty(defaultValue))
                switch (defaultValue) {
                  case "value":
                    break;
                  case "children":
                    break;
                  default:
                    setProp(domElement, tag, defaultValue, null, nextProps, name);
                }
            for (value in nextProps)
              if (name = nextProps[value], type = lastProps[value], nextProps.hasOwnProperty(value) && (null != name || null != type))
                switch (value) {
                  case "value":
                    name !== type && (viewTransitionMutationContext = true);
                    propKey$221 = name;
                    break;
                  case "defaultValue":
                    name !== type && (viewTransitionMutationContext = true);
                    propKey = name;
                    break;
                  case "children":
                    break;
                  case "dangerouslySetInnerHTML":
                    if (null != name) throw Error(formatProdErrorMessage(91));
                    break;
                  default:
                    name !== type && setProp(domElement, tag, value, name, nextProps, type);
                }
            updateTextarea(domElement, propKey$221, propKey);
            return;
          case "option":
            for (var propKey$237 in lastProps)
              if (propKey$221 = lastProps[propKey$237], lastProps.hasOwnProperty(propKey$237) && null != propKey$221 && !nextProps.hasOwnProperty(propKey$237))
                switch (propKey$237) {
                  case "selected":
                    domElement.selected = false;
                    break;
                  default:
                    setProp(
                      domElement,
                      tag,
                      propKey$237,
                      null,
                      nextProps,
                      propKey$221
                    );
                }
            for (lastDefaultValue in nextProps)
              if (propKey$221 = nextProps[lastDefaultValue], propKey = lastProps[lastDefaultValue], nextProps.hasOwnProperty(lastDefaultValue) && propKey$221 !== propKey && (null != propKey$221 || null != propKey))
                switch (lastDefaultValue) {
                  case "selected":
                    propKey$221 !== propKey && (viewTransitionMutationContext = true);
                    domElement.selected = propKey$221 && "function" !== typeof propKey$221 && "symbol" !== typeof propKey$221;
                    break;
                  default:
                    setProp(
                      domElement,
                      tag,
                      lastDefaultValue,
                      propKey$221,
                      nextProps,
                      propKey
                    );
                }
            return;
          case "img":
          case "link":
          case "area":
          case "base":
          case "br":
          case "col":
          case "embed":
          case "hr":
          case "keygen":
          case "meta":
          case "param":
          case "source":
          case "track":
          case "wbr":
          case "menuitem":
            for (var propKey$242 in lastProps)
              propKey$221 = lastProps[propKey$242], lastProps.hasOwnProperty(propKey$242) && null != propKey$221 && !nextProps.hasOwnProperty(propKey$242) && setProp(domElement, tag, propKey$242, null, nextProps, propKey$221);
            for (checked in nextProps)
              if (propKey$221 = nextProps[checked], propKey = lastProps[checked], nextProps.hasOwnProperty(checked) && propKey$221 !== propKey && (null != propKey$221 || null != propKey))
                switch (checked) {
                  case "children":
                  case "dangerouslySetInnerHTML":
                    if (null != propKey$221)
                      throw Error(formatProdErrorMessage(137, tag));
                    break;
                  default:
                    setProp(
                      domElement,
                      tag,
                      checked,
                      propKey$221,
                      nextProps,
                      propKey
                    );
                }
            return;
          default:
            if (isCustomElement(tag)) {
              for (var propKey$247 in lastProps)
                propKey$221 = lastProps[propKey$247], lastProps.hasOwnProperty(propKey$247) && void 0 !== propKey$221 && !nextProps.hasOwnProperty(propKey$247) && setPropOnCustomElement(
                  domElement,
                  tag,
                  propKey$247,
                  void 0,
                  nextProps,
                  propKey$221
                );
              for (defaultChecked in nextProps)
                propKey$221 = nextProps[defaultChecked], propKey = lastProps[defaultChecked], !nextProps.hasOwnProperty(defaultChecked) || propKey$221 === propKey || void 0 === propKey$221 && void 0 === propKey || setPropOnCustomElement(
                  domElement,
                  tag,
                  defaultChecked,
                  propKey$221,
                  nextProps,
                  propKey
                );
              return;
            }
        }
        for (var propKey$252 in lastProps)
          propKey$221 = lastProps[propKey$252], lastProps.hasOwnProperty(propKey$252) && null != propKey$221 && !nextProps.hasOwnProperty(propKey$252) && setProp(domElement, tag, propKey$252, null, nextProps, propKey$221);
        for (lastProp in nextProps)
          propKey$221 = nextProps[lastProp], propKey = lastProps[lastProp], !nextProps.hasOwnProperty(lastProp) || propKey$221 === propKey || null == propKey$221 && null == propKey || setProp(domElement, tag, lastProp, propKey$221, nextProps, propKey);
      }
      function isLikelyStaticResource(initiatorType) {
        switch (initiatorType) {
          case "css":
          case "script":
          case "font":
          case "img":
          case "image":
          case "input":
          case "link":
            return true;
          default:
            return false;
        }
      }
      function estimateBandwidth() {
        if ("function" === typeof performance.getEntriesByType) {
          for (var count = 0, bits = 0, resourceEntries = performance.getEntriesByType("resource"), i = 0; i < resourceEntries.length; i++) {
            var entry = resourceEntries[i], transferSize = entry.transferSize, initiatorType = entry.initiatorType, duration = entry.duration;
            if (transferSize && duration && isLikelyStaticResource(initiatorType)) {
              initiatorType = 0;
              duration = entry.responseEnd;
              for (i += 1; i < resourceEntries.length; i++) {
                var overlapEntry = resourceEntries[i], overlapStartTime = overlapEntry.startTime;
                if (overlapStartTime > duration) break;
                var overlapTransferSize = overlapEntry.transferSize, overlapInitiatorType = overlapEntry.initiatorType;
                overlapTransferSize && isLikelyStaticResource(overlapInitiatorType) && (overlapEntry = overlapEntry.responseEnd, initiatorType += overlapTransferSize * (overlapEntry < duration ? 1 : (duration - overlapStartTime) / (overlapEntry - overlapStartTime)));
              }
              --i;
              bits += 8 * (transferSize + initiatorType) / (entry.duration / 1e3);
              count++;
              if (10 < count) break;
            }
          }
          if (0 < count) return bits / count / 1e6;
        }
        return navigator.connection && (count = navigator.connection.downlink, "number" === typeof count) ? count : 5;
      }
      var eventsEnabled = null;
      var selectionInformation = null;
      function getOwnerDocumentFromRootContainer(rootContainerElement) {
        return 9 === rootContainerElement.nodeType ? rootContainerElement : rootContainerElement.ownerDocument;
      }
      function getOwnHostContext(namespaceURI) {
        switch (namespaceURI) {
          case "http://www.w3.org/2000/svg":
            return 1;
          case "http://www.w3.org/1998/Math/MathML":
            return 2;
          default:
            return 0;
        }
      }
      function getChildHostContextProd(parentNamespace, type) {
        if (0 === parentNamespace)
          switch (type) {
            case "svg":
              return 1;
            case "math":
              return 2;
            default:
              return 0;
          }
        return 1 === parentNamespace && "foreignObject" === type ? 0 : parentNamespace;
      }
      function createHoistableInstance(type, props, rootContainerInstance, internalInstanceHandle) {
        rootContainerInstance = getOwnerDocumentFromRootContainer(
          rootContainerInstance
        ).createElement(type);
        rootContainerInstance[internalInstanceKey] = internalInstanceHandle;
        rootContainerInstance[internalPropsKey] = props;
        setInitialProperties(rootContainerInstance, type, props);
        markNodeAsHoistable(rootContainerInstance);
        return rootContainerInstance;
      }
      function shouldSetTextContent(type, props) {
        return "textarea" === type || "noscript" === type || "string" === typeof props.children || "number" === typeof props.children || "bigint" === typeof props.children || "object" === typeof props.dangerouslySetInnerHTML && null !== props.dangerouslySetInnerHTML && null != props.dangerouslySetInnerHTML.__html;
      }
      var currentPopstateTransitionEvent = null;
      function shouldAttemptEagerTransition() {
        var event = window.event;
        if (event && "popstate" === event.type) {
          if (event === currentPopstateTransitionEvent) return false;
          currentPopstateTransitionEvent = event;
          return true;
        }
        currentPopstateTransitionEvent = null;
        return false;
      }
      var scheduleTimeout = "function" === typeof setTimeout ? setTimeout : void 0;
      var cancelTimeout = "function" === typeof clearTimeout ? clearTimeout : void 0;
      var localPromise = "function" === typeof Promise ? Promise : void 0;
      var localRequestAnimationFrame = "function" === typeof requestAnimationFrame ? requestAnimationFrame : scheduleTimeout;
      var scheduleMicrotask = "function" === typeof queueMicrotask ? queueMicrotask : "undefined" !== typeof localPromise ? function(callback) {
        return localPromise.resolve(null).then(callback).catch(handleErrorInNextTick);
      } : scheduleTimeout;
      function handleErrorInNextTick(error) {
        setTimeout(function() {
          throw error;
        });
      }
      function isSingletonScope(type) {
        return "head" === type;
      }
      function clearHydrationBoundary(parentInstance, hydrationInstance) {
        var node = hydrationInstance, depth = 0;
        do {
          var nextNode = node.nextSibling;
          parentInstance.removeChild(node);
          if (nextNode && 8 === nextNode.nodeType)
            if (node = nextNode.data, "/$" === node || "/&" === node) {
              if (0 === depth) {
                parentInstance.removeChild(nextNode);
                retryIfBlockedOn(hydrationInstance);
                return;
              }
              depth--;
            } else if ("$" === node || "$?" === node || "$~" === node || "$!" === node || "&" === node)
              depth++;
            else if ("html" === node)
              clearSingletonPreambleContribution(
                parentInstance.ownerDocument.documentElement
              );
            else if ("head" === node) {
              node = parentInstance.ownerDocument.head;
              clearSingletonPreambleContribution(node);
              for (var node$jscomp$0 = node.firstChild; node$jscomp$0; ) {
                var nextNode$jscomp$0 = node$jscomp$0.nextSibling, nodeName = node$jscomp$0.nodeName;
                node$jscomp$0[internalHoistableMarker] || "SCRIPT" === nodeName || "STYLE" === nodeName || "LINK" === nodeName && "stylesheet" === node$jscomp$0.rel.toLowerCase() || node.removeChild(node$jscomp$0);
                node$jscomp$0 = nextNode$jscomp$0;
              }
            } else
              "body" === node && clearSingletonPreambleContribution(parentInstance.ownerDocument.body);
          node = nextNode;
        } while (node);
        retryIfBlockedOn(hydrationInstance);
      }
      function hideOrUnhideDehydratedBoundary(suspenseInstance, isHidden) {
        var node = suspenseInstance;
        suspenseInstance = 0;
        do {
          var nextNode = node.nextSibling;
          1 === node.nodeType ? isHidden ? (node._stashedDisplay = node.style.display, node.style.display = "none") : (node.style.display = node._stashedDisplay || "", "" === node.getAttribute("style") && node.removeAttribute("style")) : 3 === node.nodeType && (isHidden ? (node._stashedText = node.nodeValue, node.nodeValue = "") : node.nodeValue = node._stashedText || "");
          if (nextNode && 8 === nextNode.nodeType)
            if (node = nextNode.data, "/$" === node)
              if (0 === suspenseInstance) break;
              else suspenseInstance--;
            else
              "$" !== node && "$?" !== node && "$~" !== node && "$!" !== node || suspenseInstance++;
          node = nextNode;
        } while (node);
      }
      function applyViewTransitionName(instance, name, className) {
        name = CSS.escape(name) !== name ? "r-" + btoa(name).replace(/=/g, "") : name;
        instance.style.viewTransitionName = name;
        null != className && (instance.style.viewTransitionClass = className);
        className = getComputedStyle(instance);
        if ("inline" === className.display) {
          name = instance.getClientRects();
          if (1 === name.length) var JSCompiler_inline_result = 1;
          else
            for (var i = JSCompiler_inline_result = 0; i < name.length; i++) {
              var rect = name[i];
              0 < rect.width && 0 < rect.height && JSCompiler_inline_result++;
            }
          1 === JSCompiler_inline_result && (instance = instance.style, instance.display = 1 === name.length ? "inline-block" : "block", instance.marginTop = "-" + className.paddingTop, instance.marginBottom = "-" + className.paddingBottom);
        }
      }
      function restoreViewTransitionName(instance, props) {
        instance = instance.style;
        props = props.style;
        var viewTransitionName = null != props ? props.hasOwnProperty("viewTransitionName") ? props.viewTransitionName : props.hasOwnProperty("view-transition-name") ? props["view-transition-name"] : null : null;
        instance.viewTransitionName = null == viewTransitionName || "boolean" === typeof viewTransitionName ? "" : ("" + viewTransitionName).trim();
        viewTransitionName = null != props ? props.hasOwnProperty("viewTransitionClass") ? props.viewTransitionClass : props.hasOwnProperty("view-transition-class") ? props["view-transition-class"] : null : null;
        instance.viewTransitionClass = null == viewTransitionName || "boolean" === typeof viewTransitionName ? "" : ("" + viewTransitionName).trim();
        "inline-block" === instance.display && (null == props ? instance.display = instance.margin = "" : (viewTransitionName = props.display, instance.display = null == viewTransitionName || "boolean" === typeof viewTransitionName ? "" : viewTransitionName, viewTransitionName = props.margin, null != viewTransitionName ? instance.margin = viewTransitionName : (viewTransitionName = props.hasOwnProperty("marginTop") ? props.marginTop : props["margin-top"], instance.marginTop = null == viewTransitionName || "boolean" === typeof viewTransitionName ? "" : viewTransitionName, props = props.hasOwnProperty("marginBottom") ? props.marginBottom : props["margin-bottom"], instance.marginBottom = null == props || "boolean" === typeof props ? "" : props)));
      }
      function createMeasurement(rect, computedStyle, element) {
        element = element.ownerDocument.defaultView;
        return {
          rect,
          abs: "absolute" === computedStyle.position || "fixed" === computedStyle.position,
          clip: "none" !== computedStyle.clipPath || "visible" !== computedStyle.overflow || "none" !== computedStyle.filter || "none" !== computedStyle.mask || "none" !== computedStyle.mask || "0px" !== computedStyle.borderRadius,
          view: 0 <= rect.bottom && 0 <= rect.right && rect.top <= element.innerHeight && rect.left <= element.innerWidth
        };
      }
      function measureInstance(instance) {
        var rect = instance.getBoundingClientRect(), computedStyle = getComputedStyle(instance);
        return createMeasurement(rect, computedStyle, instance);
      }
      function measureClonedInstance(instance) {
        var measuredRect = instance.getBoundingClientRect();
        measuredRect = new DOMRect(
          measuredRect.x + 2e4,
          measuredRect.y + 2e4,
          measuredRect.width,
          measuredRect.height
        );
        var computedStyle = getComputedStyle(instance);
        return createMeasurement(measuredRect, computedStyle, instance);
      }
      function forceLayout(ownerDocument) {
        return ownerDocument.documentElement.clientHeight;
      }
      function waitForImageToLoad(resolve) {
        this.addEventListener("load", resolve);
        this.addEventListener("error", resolve);
      }
      function startViewTransition(suspendedState, rootContainer, transitionTypes, mutationCallback, layoutCallback, afterMutationCallback, spawnedWorkCallback, passiveCallback, errorCallback) {
        var ownerDocument = 9 === rootContainer.nodeType ? rootContainer : rootContainer.ownerDocument;
        try {
          var transition = ownerDocument.startViewTransition({
            update: function() {
              var ownerWindow = ownerDocument.defaultView, pendingNavigation = ownerWindow.navigation && ownerWindow.navigation.transition, previousFontLoadingStatus = ownerDocument.fonts.status;
              mutationCallback();
              var blockingPromises = [];
              "loaded" === previousFontLoadingStatus && (forceLayout(ownerDocument), "loading" === ownerDocument.fonts.status && blockingPromises.push(ownerDocument.fonts.ready));
              previousFontLoadingStatus = blockingPromises.length;
              if (null !== suspendedState)
                for (var suspenseyImages = suspendedState.suspenseyImages, imgBytes = 0, i = 0; i < suspenseyImages.length; i++) {
                  var suspenseyImage = suspenseyImages[i];
                  if (!suspenseyImage.complete) {
                    var rect = suspenseyImage.getBoundingClientRect();
                    if (0 < rect.bottom && 0 < rect.right && rect.top < ownerWindow.innerHeight && rect.left < ownerWindow.innerWidth) {
                      imgBytes += estimateImageBytes(suspenseyImage);
                      if (imgBytes > estimatedBytesWithinLimit) {
                        blockingPromises.length = previousFontLoadingStatus;
                        break;
                      }
                      suspenseyImage = new Promise(
                        waitForImageToLoad.bind(suspenseyImage)
                      );
                      blockingPromises.push(suspenseyImage);
                    }
                  }
                }
              if (0 < blockingPromises.length)
                return ownerWindow = Promise.race([
                  Promise.all(blockingPromises),
                  new Promise(function(resolve) {
                    return setTimeout(resolve, 500);
                  })
                ]).then(layoutCallback, layoutCallback), (pendingNavigation ? Promise.allSettled([pendingNavigation.finished, ownerWindow]) : ownerWindow).then(afterMutationCallback, afterMutationCallback);
              layoutCallback();
              if (pendingNavigation)
                return pendingNavigation.finished.then(
                  afterMutationCallback,
                  afterMutationCallback
                );
              afterMutationCallback();
            },
            types: transitionTypes
          });
          ownerDocument.__reactViewTransition = transition;
          var viewTransitionAnimations = [];
          transition.ready.then(
            function() {
              for (var animations = ownerDocument.documentElement.getAnimations({
                subtree: true
              }), i = 0; i < animations.length; i++) {
                var animation = animations[i], effect = animation.effect, pseudoElement = effect.pseudoElement;
                if (null != pseudoElement && pseudoElement.startsWith("::view-transition")) {
                  viewTransitionAnimations.push(animation);
                  animation = effect.getKeyframes();
                  for (var height = pseudoElement = void 0, unchangedDimensions = true, j = 0; j < animation.length; j++) {
                    var keyframe = animation[j], w = keyframe.width;
                    if (void 0 === pseudoElement) pseudoElement = w;
                    else if (pseudoElement !== w) {
                      unchangedDimensions = false;
                      break;
                    }
                    w = keyframe.height;
                    if (void 0 === height) height = w;
                    else if (height !== w) {
                      unchangedDimensions = false;
                      break;
                    }
                    delete keyframe.width;
                    delete keyframe.height;
                    "none" === keyframe.transform && delete keyframe.transform;
                  }
                  unchangedDimensions && void 0 !== pseudoElement && void 0 !== height && (effect.setKeyframes(animation), unchangedDimensions = getComputedStyle(
                    effect.target,
                    effect.pseudoElement
                  ), unchangedDimensions.width !== pseudoElement || unchangedDimensions.height !== height) && (unchangedDimensions = animation[0], unchangedDimensions.width = pseudoElement, unchangedDimensions.height = height, unchangedDimensions = animation[animation.length - 1], unchangedDimensions.width = pseudoElement, unchangedDimensions.height = height, effect.setKeyframes(animation));
                }
              }
              spawnedWorkCallback();
            },
            function(error) {
              ownerDocument.__reactViewTransition === transition && (ownerDocument.__reactViewTransition = null);
              try {
                if ("object" === typeof error && null !== error)
                  switch (error.name) {
                    case "InvalidStateError":
                      if ("View transition was skipped because document visibility state is hidden." === error.message || "Skipping view transition because document visibility state has become hidden." === error.message || "Skipping view transition because viewport size changed." === error.message || "Transition was aborted because of invalid state" === error.message)
                        error = null;
                  }
                null !== error && errorCallback(error);
              } finally {
                mutationCallback(), layoutCallback(), spawnedWorkCallback();
              }
            }
          );
          transition.finished.finally(function() {
            for (var i = 0; i < viewTransitionAnimations.length; i++)
              viewTransitionAnimations[i].cancel();
            ownerDocument.__reactViewTransition === transition && (ownerDocument.__reactViewTransition = null);
            passiveCallback();
          });
          return transition;
        } catch (x) {
          return mutationCallback(), layoutCallback(), spawnedWorkCallback(), null;
        }
      }
      function ViewTransitionPseudoElement(pseudo, name) {
        this._scope = document.documentElement;
        this._selector = "::view-transition-" + pseudo + "(" + name + ")";
      }
      ViewTransitionPseudoElement.prototype.animate = function(keyframes, options2) {
        options2 = "number" === typeof options2 ? { duration: options2 } : assign({}, options2);
        options2.pseudoElement = this._selector;
        return this._scope.animate(keyframes, options2);
      };
      ViewTransitionPseudoElement.prototype.getAnimations = function() {
        for (var scope = this._scope, selector = this._selector, animations = scope.getAnimations({ subtree: true }), result = [], i = 0; i < animations.length; i++) {
          var effect = animations[i].effect;
          null !== effect && effect.target === scope && effect.pseudoElement === selector && result.push(animations[i]);
        }
        return result;
      };
      ViewTransitionPseudoElement.prototype.getComputedStyle = function() {
        return getComputedStyle(this._scope, this._selector);
      };
      function createViewTransitionInstance(name) {
        return {
          name,
          group: new ViewTransitionPseudoElement("group", name),
          imagePair: new ViewTransitionPseudoElement("image-pair", name),
          old: new ViewTransitionPseudoElement("old", name),
          new: new ViewTransitionPseudoElement("new", name)
        };
      }
      function FragmentInstance(fragmentFiber) {
        this._fragmentFiber = fragmentFiber;
        this._observers = this._eventListeners = null;
      }
      FragmentInstance.prototype.addEventListener = function(type, listener, optionsOrUseCapture) {
        var signal = null, cleanup = null;
        if (null != optionsOrUseCapture && "boolean" !== typeof optionsOrUseCapture && (signal = optionsOrUseCapture.signal || null, null !== signal && signal.aborted))
          return;
        null === this._eventListeners && (this._eventListeners = []);
        var listeners = this._eventListeners;
        if (-1 === indexOfEventListener(listeners, type, listener, optionsOrUseCapture)) {
          var fragmentInstance = this, attachedListener = listener;
          null != optionsOrUseCapture && "boolean" !== typeof optionsOrUseCapture && true === optionsOrUseCapture.once && (attachedListener = function(event) {
            fragmentInstance.removeEventListener(
              type,
              listener,
              optionsOrUseCapture
            );
            "function" === typeof listener ? listener.call(this, event) : listener.handleEvent(event);
          });
          null !== signal && (cleanup = fragmentInstance.removeEventListener.bind(
            fragmentInstance,
            type,
            listener,
            optionsOrUseCapture
          ), signal.addEventListener("abort", cleanup, { once: true }), cleanup = signal.removeEventListener.bind(signal, "abort", cleanup));
          signal = getAttachOptions(optionsOrUseCapture);
          listeners.push({
            type,
            listener,
            optionsOrUseCapture,
            attachedListener,
            cleanup
          });
          traverseVisibleInstancesAndTextInstances(
            this._fragmentFiber.child,
            false,
            addEventListenerToChild,
            type,
            attachedListener,
            signal
          );
        }
        this._eventListeners = listeners;
      };
      function addEventListenerToChild(child, type, listener, optionsOrUseCapture) {
        getInstanceFromHostFiber(child).addEventListener(
          type,
          listener,
          optionsOrUseCapture
        );
        return false;
      }
      FragmentInstance.prototype.removeEventListener = function(type, listener, optionsOrUseCapture) {
        var listeners = this._eventListeners;
        if (null !== listeners && (listener = indexOfEventListener(
          listeners,
          type,
          listener,
          optionsOrUseCapture
        ), -1 !== listener)) {
          var _listeners$index = listeners[listener];
          optionsOrUseCapture = _listeners$index.attachedListener;
          var cleanup = _listeners$index.cleanup;
          _listeners$index = getAttachOptions(_listeners$index.optionsOrUseCapture);
          traverseVisibleInstancesAndTextInstances(
            this._fragmentFiber.child,
            false,
            removeEventListenerFromChild,
            type,
            optionsOrUseCapture,
            _listeners$index
          );
          listeners.splice(listener, 1);
          null !== cleanup && cleanup();
        }
      };
      function removeEventListenerFromChild(child, type, listener, optionsOrUseCapture) {
        getInstanceFromHostFiber(child).removeEventListener(
          type,
          listener,
          optionsOrUseCapture
        );
        return false;
      }
      function getAttachOptions(opts) {
        return null != opts && "boolean" !== typeof opts && (true === opts.once || opts.signal instanceof AbortSignal) ? { capture: opts.capture, passive: opts.passive } : opts;
      }
      function normalizeListenerOptions(opts) {
        return null == opts ? "c=0" : "boolean" === typeof opts ? "c=" + (opts ? "1" : "0") : "c=" + (opts.capture ? "1" : "0");
      }
      function indexOfEventListener(eventListeners, type, listener, optionsOrUseCapture) {
        if (0 === eventListeners.length) return -1;
        optionsOrUseCapture = normalizeListenerOptions(optionsOrUseCapture);
        for (var i = 0; i < eventListeners.length; i++) {
          var item = eventListeners[i];
          if (item.type === type && item.listener === listener && normalizeListenerOptions(item.optionsOrUseCapture) === optionsOrUseCapture)
            return i;
        }
        return -1;
      }
      FragmentInstance.prototype.dispatchEvent = function(event) {
        var parentHostFiber = getFragmentParentInstanceOrContainerFiber(
          this._fragmentFiber
        );
        if (null === parentHostFiber) return true;
        parentHostFiber = getInstanceFromHostFiber(parentHostFiber);
        var eventListeners = this._eventListeners;
        if (null !== eventListeners && 0 < eventListeners.length || !event.bubbles) {
          var temp = 9 === parentHostFiber.nodeType ? parentHostFiber.createComment("") : document.createTextNode("");
          if (eventListeners)
            for (var i = 0; i < eventListeners.length; i++) {
              var _eventListeners$i = eventListeners[i];
              temp.addEventListener(
                _eventListeners$i.type,
                _eventListeners$i.attachedListener,
                getAttachOptions(_eventListeners$i.optionsOrUseCapture)
              );
            }
          parentHostFiber.appendChild(temp);
          event = temp.dispatchEvent(event);
          if (eventListeners)
            for (i = 0; i < eventListeners.length; i++)
              _eventListeners$i = eventListeners[i], temp.removeEventListener(
                _eventListeners$i.type,
                _eventListeners$i.attachedListener,
                getAttachOptions(_eventListeners$i.optionsOrUseCapture)
              );
          parentHostFiber.removeChild(temp);
          return event;
        }
        return parentHostFiber.dispatchEvent(event);
      };
      FragmentInstance.prototype.focus = function(focusOptions) {
        traverseVisibleInstancesAndTextInstances(
          this._fragmentFiber.child,
          true,
          setFocusOnFiberIfFocusable,
          focusOptions,
          void 0,
          void 0
        );
      };
      function setFocusOnFiberIfFocusable(fiber, focusOptions) {
        if (6 === fiber.tag) return false;
        fiber = getInstanceFromHostFiber(fiber);
        return setFocusIfFocusable(fiber, focusOptions);
      }
      FragmentInstance.prototype.focusLast = function(focusOptions) {
        var children = [];
        traverseVisibleInstancesAndTextInstances(
          this._fragmentFiber.child,
          true,
          collectChildren,
          children,
          void 0,
          void 0
        );
        for (var i = children.length - 1; 0 <= i && !setFocusOnFiberIfFocusable(children[i], focusOptions); i--) ;
      };
      function collectChildren(child, collection) {
        collection.push(child);
        return false;
      }
      FragmentInstance.prototype.blur = function() {
        var parentHostFiber = getFragmentParentInstanceOrContainerFiber(
          this._fragmentFiber
        );
        null !== parentHostFiber && (parentHostFiber = getInstanceFromHostFiber(parentHostFiber), parentHostFiber = getOwnerDocumentFromRootContainer(parentHostFiber).activeElement, null !== parentHostFiber && traverseVisibleInstancesAndTextInstances(
          this._fragmentFiber.child,
          false,
          blurActiveElementWithinFragment,
          parentHostFiber,
          void 0,
          void 0
        ));
      };
      function blurActiveElementWithinFragment(child, activeElement2) {
        if (6 === child.tag) return false;
        child = getInstanceFromHostFiber(child);
        return child === activeElement2 || child.contains(activeElement2) ? (activeElement2.blur(), true) : false;
      }
      FragmentInstance.prototype.observeUsing = function(observer) {
        null === this._observers && (this._observers = /* @__PURE__ */ new Set());
        this._observers.add(observer);
        traverseVisibleInstancesAndTextInstances(
          this._fragmentFiber.child,
          false,
          observeChild,
          observer,
          void 0,
          void 0
        );
      };
      function observeChild(child, observer) {
        if (6 === child.tag) return false;
        child = getInstanceFromHostFiber(child);
        observer.observe(child);
        return false;
      }
      FragmentInstance.prototype.unobserveUsing = function(observer) {
        var observers = this._observers;
        if (null !== observers && observers.has(observer)) {
          observers.delete(observer);
          traverseVisibleInstancesAndTextInstances(
            this._fragmentFiber.child,
            false,
            unobserveChild,
            observer,
            void 0,
            void 0
          );
          for (var i = observers = 0; i < pendingIntersectionUnobserves.length; i++) {
            var pending = pendingIntersectionUnobserves[i];
            pending.fragmentInstance === this && pending.observer === observer ? observer.unobserve(pending.instance) : pendingIntersectionUnobserves[observers++] = pending;
          }
          pendingIntersectionUnobserves.length = observers;
        }
      };
      function unobserveChild(child, observer) {
        if (6 === child.tag) return false;
        child = getInstanceFromHostFiber(child);
        observer.unobserve(child);
        return false;
      }
      var pendingIntersectionUnobserves = [];
      var intersectionUnobserveScheduled = false;
      function schedulePendingIntersectionUnobserve(fragmentInstance, observer, instance) {
        pendingIntersectionUnobserves.push({
          fragmentInstance,
          observer,
          instance
        });
        intersectionUnobserveScheduled || (intersectionUnobserveScheduled = true, requestPostPaintCallback(function() {
          intersectionUnobserveScheduled = false;
          var pending = pendingIntersectionUnobserves;
          pendingIntersectionUnobserves = [];
          for (var i = 0; i < pending.length; i++) {
            var item = pending[i];
            item.observer.unobserve(item.instance);
          }
        }));
      }
      FragmentInstance.prototype.getClientRects = function() {
        var rects = [];
        traverseVisibleInstancesAndTextInstances(
          this._fragmentFiber.child,
          false,
          collectClientRects,
          rects,
          void 0,
          void 0
        );
        return rects;
      };
      function collectClientRects(child, rects) {
        if (6 === child.tag) {
          child = child.stateNode;
          var range = child.ownerDocument.createRange();
          range.selectNodeContents(child);
          rects.push.apply(rects, range.getClientRects());
        } else
          child = getInstanceFromHostFiber(child), rects.push.apply(rects, child.getClientRects());
        return false;
      }
      FragmentInstance.prototype.getRootNode = function(getRootNodeOptions) {
        var parentHostFiber = getFragmentParentInstanceOrContainerFiber(
          this._fragmentFiber
        );
        return null === parentHostFiber ? this : getInstanceFromHostFiber(parentHostFiber).getRootNode(getRootNodeOptions);
      };
      FragmentInstance.prototype.compareDocumentPosition = function(otherNode) {
        var parentHostFiber = getFragmentParentInstanceOrContainerFiber(
          this._fragmentFiber
        );
        if (null === parentHostFiber) return Node.DOCUMENT_POSITION_DISCONNECTED;
        var children = [];
        traverseVisibleInstancesAndTextInstances(
          this._fragmentFiber.child,
          false,
          collectChildren,
          children,
          void 0,
          void 0
        );
        var parentHostInstance = getInstanceFromHostFiber(parentHostFiber);
        if (0 === children.length) {
          children = parentHostInstance;
          if (fiberIsPortaledIntoHost(this._fragmentFiber)) {
            a: {
              for (parentHostFiber = this._fragmentFiber.return; null !== parentHostFiber; ) {
                if (4 === parentHostFiber.tag) {
                  parentHostFiber = parentHostFiber.stateNode.containerInfo;
                  break a;
                }
                if (3 === parentHostFiber.tag || 5 === parentHostFiber.tag || 27 === parentHostFiber.tag)
                  break;
                parentHostFiber = parentHostFiber.return;
              }
              parentHostFiber = null;
            }
            null != parentHostFiber && (children = parentHostFiber);
          }
          parentHostFiber = this._fragmentFiber;
          var result = parentHostInstance = children.compareDocumentPosition(otherNode);
          children === otherNode ? result = Node.DOCUMENT_POSITION_CONTAINS : parentHostInstance & Node.DOCUMENT_POSITION_CONTAINED_BY && (children = getFragmentInstanceOrTextInstanceSiblings(parentHostFiber)[1], null === children ? result = Node.DOCUMENT_POSITION_PRECEDING : (otherNode = getInstanceFromHostFiber(children).compareDocumentPosition(
            otherNode
          ), result = 0 === otherNode || otherNode & Node.DOCUMENT_POSITION_FOLLOWING ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING));
          return result |= Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
        }
        parentHostFiber = getInstanceFromHostFiber(children[0]);
        result = getInstanceFromHostFiber(children[children.length - 1]);
        var parentHostInstanceFromDOM = fiberIsPortaledIntoHost(this._fragmentFiber) ? parentHostFiber.parentElement : parentHostInstance;
        if (null == parentHostInstanceFromDOM)
          return Node.DOCUMENT_POSITION_DISCONNECTED;
        parentHostInstance = parentHostInstanceFromDOM.compareDocumentPosition(parentHostFiber) & Node.DOCUMENT_POSITION_CONTAINED_BY;
        parentHostInstanceFromDOM = parentHostInstanceFromDOM.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_CONTAINED_BY;
        var firstResult = parentHostFiber.compareDocumentPosition(otherNode), lastResult = result.compareDocumentPosition(otherNode), otherNodeIsWithinFirstOrLastChild = firstResult & Node.DOCUMENT_POSITION_CONTAINED_BY || lastResult & Node.DOCUMENT_POSITION_CONTAINED_BY;
        lastResult = parentHostInstance && parentHostInstanceFromDOM && firstResult & Node.DOCUMENT_POSITION_FOLLOWING && lastResult & Node.DOCUMENT_POSITION_PRECEDING;
        parentHostFiber = parentHostInstance && parentHostFiber === otherNode || parentHostInstanceFromDOM && result === otherNode || otherNodeIsWithinFirstOrLastChild || lastResult ? Node.DOCUMENT_POSITION_CONTAINED_BY : !parentHostInstance && parentHostFiber === otherNode || !parentHostInstanceFromDOM && result === otherNode ? Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC : firstResult;
        return parentHostFiber & Node.DOCUMENT_POSITION_DISCONNECTED || parentHostFiber & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC || validateDocumentPositionWithFiberTree(
          parentHostFiber,
          this._fragmentFiber,
          children[0],
          children[children.length - 1],
          otherNode
        ) ? parentHostFiber : Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
      };
      function validateDocumentPositionWithFiberTree(documentPosition, fragmentFiber, precedingBoundaryFiber, followingBoundaryFiber, otherNode) {
        var otherFiber = getClosestInstanceFromNode(otherNode);
        if (documentPosition & Node.DOCUMENT_POSITION_CONTAINED_BY) {
          if (precedingBoundaryFiber = !!otherFiber)
            a: {
              for (; null !== otherFiber; ) {
                if (7 === otherFiber.tag && (otherFiber === fragmentFiber || otherFiber.alternate === fragmentFiber)) {
                  precedingBoundaryFiber = true;
                  break a;
                }
                otherFiber = otherFiber.return;
              }
              precedingBoundaryFiber = false;
            }
          return precedingBoundaryFiber;
        }
        if (documentPosition & Node.DOCUMENT_POSITION_CONTAINS) {
          if (null === otherFiber)
            return otherFiber = otherNode.ownerDocument, otherNode === otherFiber || otherNode === otherFiber.documentElement || otherNode === otherFiber.body;
          a: {
            otherFiber = fragmentFiber;
            for (fragmentFiber = getFragmentParentInstanceOrContainerFiber(fragmentFiber); null !== otherFiber; ) {
              if (!(5 !== otherFiber.tag && 3 !== otherFiber.tag && 27 !== otherFiber.tag || otherFiber !== fragmentFiber && otherFiber.alternate !== fragmentFiber)) {
                otherFiber = true;
                break a;
              }
              otherFiber = otherFiber.return;
            }
            otherFiber = false;
          }
          return otherFiber;
        }
        return documentPosition & Node.DOCUMENT_POSITION_PRECEDING ? ((fragmentFiber = !!otherFiber) && !(fragmentFiber = otherFiber === precedingBoundaryFiber) && (fragmentFiber = getLowestCommonAncestor(
          precedingBoundaryFiber,
          otherFiber,
          getParentForFragmentAncestors
        ), null === fragmentFiber ? fragmentFiber = false : (traverseVisibleInstancesAndTextInstances(
          fragmentFiber,
          true,
          isFiberPrecedingCheck,
          otherFiber,
          precedingBoundaryFiber
        ), otherFiber = searchTarget, searchTarget = null, fragmentFiber = null !== otherFiber)), fragmentFiber) : documentPosition & Node.DOCUMENT_POSITION_FOLLOWING ? ((fragmentFiber = !!otherFiber) && !(fragmentFiber = otherFiber === followingBoundaryFiber) && (fragmentFiber = getLowestCommonAncestor(
          followingBoundaryFiber,
          otherFiber,
          getParentForFragmentAncestors
        ), null === fragmentFiber ? fragmentFiber = false : (traverseVisibleInstancesAndTextInstances(
          fragmentFiber,
          true,
          isFiberFollowingCheck,
          otherFiber,
          followingBoundaryFiber
        ), otherFiber = searchTarget, searchBoundary = searchTarget = null, fragmentFiber = null !== otherFiber)), fragmentFiber) : false;
      }
      function scrollTextNodeIntoView(textNode, resolvedAlignToTop) {
        var range = textNode.ownerDocument.createRange();
        range.selectNodeContents(textNode);
        textNode = range.getBoundingClientRect();
        window.scrollTo(
          window.scrollX + textNode.left,
          resolvedAlignToTop ? window.scrollY + textNode.top : window.scrollY + textNode.bottom - window.innerHeight
        );
      }
      FragmentInstance.prototype.scrollIntoView = function(alignToTop) {
        if ("object" === typeof alignToTop) throw Error(formatProdErrorMessage(566));
        var children = [];
        traverseVisibleInstancesAndTextInstances(
          this._fragmentFiber.child,
          false,
          collectChildren,
          children,
          void 0,
          void 0
        );
        var resolvedAlignToTop = false !== alignToTop;
        if (0 === children.length) {
          var hostSiblings = getFragmentInstanceOrTextInstanceSiblings(
            this._fragmentFiber
          );
          hostSiblings = resolvedAlignToTop ? hostSiblings[1] || hostSiblings[0] || getFragmentParentInstanceOrContainerFiber(this._fragmentFiber) : hostSiblings[0] || hostSiblings[1];
          if (null === hostSiblings) return;
          if (6 === hostSiblings.tag) {
            alignToTop = getInstanceFromHostFiber(hostSiblings);
            scrollTextNodeIntoView(alignToTop, resolvedAlignToTop);
            return;
          }
          hostSiblings = getInstanceFromHostFiber(hostSiblings);
          if (9 !== hostSiblings.nodeType) {
            if (11 === hostSiblings.nodeType) {
              resolvedAlignToTop = "host" in hostSiblings ? hostSiblings.host : null;
              null !== resolvedAlignToTop && resolvedAlignToTop.scrollIntoView(alignToTop);
              return;
            }
            hostSiblings.scrollIntoView(alignToTop);
          }
        }
        for (hostSiblings = resolvedAlignToTop ? children.length - 1 : 0; hostSiblings !== (resolvedAlignToTop ? -1 : children.length); ) {
          var child = children[hostSiblings];
          6 === child.tag ? (child = getInstanceFromHostFiber(child), scrollTextNodeIntoView(child, resolvedAlignToTop)) : getInstanceFromHostFiber(child).scrollIntoView(alignToTop);
          hostSiblings += resolvedAlignToTop ? -1 : 1;
        }
      };
      function addFragmentHandleToFiber(child, fragmentInstance) {
        child = getInstanceFromHostFiber(child);
        addFragmentHandleToInstance(child, fragmentInstance);
        return false;
      }
      function addFragmentHandleToInstance(instance, fragmentInstance) {
        null == instance.reactFragments && (instance.reactFragments = /* @__PURE__ */ new Set());
        instance.reactFragments.add(fragmentInstance);
      }
      function commitNewChildToFragmentInstance(childInstance, fragmentInstance) {
        var eventListeners = fragmentInstance._eventListeners;
        if (null !== eventListeners)
          for (var i$jscomp$0 = 0; i$jscomp$0 < eventListeners.length; i$jscomp$0++) {
            var _eventListeners$i3 = eventListeners[i$jscomp$0];
            childInstance.addEventListener(
              _eventListeners$i3.type,
              _eventListeners$i3.attachedListener,
              getAttachOptions(_eventListeners$i3.optionsOrUseCapture)
            );
          }
        3 !== childInstance.nodeType && (eventListeners = fragmentInstance._observers, null !== eventListeners && eventListeners.forEach(function(observer) {
          for (var writeIdx = 0, i = 0; i < pendingIntersectionUnobserves.length; i++) {
            var pending = pendingIntersectionUnobserves[i];
            if (pending.fragmentInstance !== fragmentInstance || pending.observer !== observer || pending.instance !== childInstance)
              pendingIntersectionUnobserves[writeIdx++] = pending;
          }
          pendingIntersectionUnobserves.length = writeIdx;
          observer.observe(childInstance);
        }), addFragmentHandleToInstance(childInstance, fragmentInstance));
      }
      function deleteChildFromFragmentInstance(childInstance, fragmentInstance) {
        var eventListeners = fragmentInstance._eventListeners;
        if (null !== eventListeners)
          for (var i = 0; i < eventListeners.length; i++) {
            var _eventListeners$i4 = eventListeners[i];
            childInstance.removeEventListener(
              _eventListeners$i4.type,
              _eventListeners$i4.attachedListener,
              getAttachOptions(_eventListeners$i4.optionsOrUseCapture)
            );
          }
        3 !== childInstance.nodeType && (eventListeners = fragmentInstance._observers, null !== eventListeners && eventListeners.forEach(function(observer) {
          "string" === typeof observer.rootMargin ? schedulePendingIntersectionUnobserve(
            fragmentInstance,
            observer,
            childInstance
          ) : observer.unobserve(childInstance);
        }), null != childInstance.reactFragments && childInstance.reactFragments.delete(fragmentInstance));
      }
      function clearContainerSparingly(container) {
        var nextNode = container.firstChild;
        nextNode && 10 === nextNode.nodeType && (nextNode = nextNode.nextSibling);
        for (; nextNode; ) {
          var node = nextNode;
          nextNode = nextNode.nextSibling;
          switch (node.nodeName) {
            case "HTML":
            case "HEAD":
            case "BODY":
              clearContainerSparingly(node);
              detachDeletedInstance(node);
              continue;
            case "SCRIPT":
            case "STYLE":
              continue;
            case "LINK":
              if ("stylesheet" === node.rel.toLowerCase()) continue;
          }
          container.removeChild(node);
        }
      }
      function canHydrateInstance(instance, type, props, inRootOrSingleton) {
        for (; 1 === instance.nodeType; ) {
          var anyProps = props;
          if (instance.nodeName.toLowerCase() !== type.toLowerCase()) {
            if (!inRootOrSingleton && ("INPUT" !== instance.nodeName || "hidden" !== instance.type))
              break;
          } else if (!inRootOrSingleton)
            if ("input" === type && "hidden" === instance.type) {
              var name = null == anyProps.name ? null : "" + anyProps.name;
              if ("hidden" === anyProps.type && instance.getAttribute("name") === name)
                return instance;
            } else return instance;
          else if (!instance[internalHoistableMarker])
            switch (type) {
              case "meta":
                if (!instance.hasAttribute("itemprop")) break;
                return instance;
              case "link":
                name = instance.getAttribute("rel");
                if ("stylesheet" === name && instance.hasAttribute("data-precedence"))
                  break;
                else if (name !== anyProps.rel || instance.getAttribute("href") !== (null == anyProps.href || "" === anyProps.href ? null : anyProps.href) || instance.getAttribute("crossorigin") !== (null == anyProps.crossOrigin ? null : anyProps.crossOrigin) || instance.getAttribute("title") !== (null == anyProps.title ? null : anyProps.title))
                  break;
                return instance;
              case "style":
                if (instance.hasAttribute("data-precedence")) break;
                return instance;
              case "script":
                name = instance.getAttribute("src");
                if ((name !== (null == anyProps.src ? null : anyProps.src) || instance.getAttribute("type") !== (null == anyProps.type ? null : anyProps.type) || instance.getAttribute("crossorigin") !== (null == anyProps.crossOrigin ? null : anyProps.crossOrigin)) && name && instance.hasAttribute("async") && !instance.hasAttribute("itemprop"))
                  break;
                return instance;
              default:
                return instance;
            }
          instance = getNextHydratable(instance.nextSibling);
          if (null === instance) break;
        }
        return null;
      }
      function canHydrateTextInstance(instance, text, inRootOrSingleton) {
        if ("" === text) return null;
        for (; 3 !== instance.nodeType; ) {
          if ((1 !== instance.nodeType || "INPUT" !== instance.nodeName || "hidden" !== instance.type) && !inRootOrSingleton)
            return null;
          instance = getNextHydratable(instance.nextSibling);
          if (null === instance) return null;
        }
        return instance;
      }
      function canHydrateHydrationBoundary(instance, inRootOrSingleton) {
        for (; 8 !== instance.nodeType; ) {
          if ((1 !== instance.nodeType || "INPUT" !== instance.nodeName || "hidden" !== instance.type) && !inRootOrSingleton)
            return null;
          instance = getNextHydratable(instance.nextSibling);
          if (null === instance) return null;
        }
        return instance;
      }
      function isSuspenseInstancePending(instance) {
        return "$?" === instance.data || "$~" === instance.data;
      }
      function isSuspenseInstanceFallback(instance) {
        return "$!" === instance.data || "$?" === instance.data && "loading" !== instance.ownerDocument.readyState;
      }
      function registerSuspenseInstanceRetry(instance, callback) {
        var ownerDocument = instance.ownerDocument;
        if ("$~" === instance.data) instance._reactRetry = callback;
        else if ("$?" !== instance.data || "loading" !== ownerDocument.readyState)
          callback();
        else {
          var listener = function() {
            callback();
            ownerDocument.removeEventListener("DOMContentLoaded", listener);
          };
          ownerDocument.addEventListener("DOMContentLoaded", listener);
          instance._reactRetry = listener;
        }
      }
      function getNextHydratable(node) {
        for (; null != node; node = node.nextSibling) {
          var nodeType = node.nodeType;
          if (1 === nodeType || 3 === nodeType) break;
          if (8 === nodeType) {
            nodeType = node.data;
            if ("$" === nodeType || "$!" === nodeType || "$?" === nodeType || "$~" === nodeType || "&" === nodeType || "F!" === nodeType || "F" === nodeType)
              break;
            if ("/$" === nodeType || "/&" === nodeType) return null;
          }
        }
        return node;
      }
      var previousHydratableOnEnteringScopedSingleton = null;
      function getNextHydratableInstanceAfterHydrationBoundary(hydrationInstance) {
        hydrationInstance = hydrationInstance.nextSibling;
        for (var depth = 0; hydrationInstance; ) {
          if (8 === hydrationInstance.nodeType) {
            var data = hydrationInstance.data;
            if ("/$" === data || "/&" === data) {
              if (0 === depth)
                return getNextHydratable(hydrationInstance.nextSibling);
              depth--;
            } else
              "$" !== data && "$!" !== data && "$?" !== data && "$~" !== data && "&" !== data || depth++;
          }
          hydrationInstance = hydrationInstance.nextSibling;
        }
        return null;
      }
      function getParentHydrationBoundary(targetInstance) {
        targetInstance = targetInstance.previousSibling;
        for (var depth = 0; targetInstance; ) {
          if (8 === targetInstance.nodeType) {
            var data = targetInstance.data;
            if ("$" === data || "$!" === data || "$?" === data || "$~" === data || "&" === data) {
              if (0 === depth) return targetInstance;
              depth--;
            } else "/$" !== data && "/&" !== data || depth++;
          }
          targetInstance = targetInstance.previousSibling;
        }
        return null;
      }
      function setFocusIfFocusable(node, focusOptions) {
        function handleFocus() {
          didFocus = true;
        }
        if (node.ownerDocument.activeElement === node) return true;
        var didFocus = false;
        try {
          node.ownerDocument.addEventListener("focus", handleFocus, true), (node.focus || HTMLElement.prototype.focus).call(node, focusOptions);
        } finally {
          node.ownerDocument.removeEventListener("focus", handleFocus, true);
        }
        return didFocus;
      }
      function requestPostPaintCallback(callback) {
        localRequestAnimationFrame(function() {
          localRequestAnimationFrame(function(time) {
            return callback(time);
          });
        });
      }
      function resolveSingletonInstance(type, props, rootContainerInstance) {
        props = getOwnerDocumentFromRootContainer(rootContainerInstance);
        switch (type) {
          case "html":
            type = props.documentElement;
            if (!type) throw Error(formatProdErrorMessage(452));
            return type;
          case "head":
            type = props.head;
            if (!type) throw Error(formatProdErrorMessage(453));
            return type;
          case "body":
            type = props.body;
            if (!type) throw Error(formatProdErrorMessage(454));
            return type;
          default:
            throw Error(formatProdErrorMessage(451));
        }
      }
      function releaseSingletonInstance(instance, type, props) {
        for (var propKey in props) {
          var propValue = props[propKey];
          props.hasOwnProperty(propKey) && null != propValue && setProp(instance, type, propKey, null, emptyProps, propValue);
        }
        null != props.dangerouslySetInnerHTML && (instance.textContent = "");
        instance.onclick === noop$1 && (instance.onclick = null);
        detachDeletedInstance(instance);
      }
      function clearSingletonPreambleContribution(instance) {
        for (var attributes = instance.attributes; attributes.length; )
          instance.removeAttributeNode(attributes[0]);
        detachDeletedInstance(instance);
      }
      var preloadPropsMap = /* @__PURE__ */ new Map();
      var preconnectsSet = /* @__PURE__ */ new Set();
      function getHoistableRoot(container) {
        if ("function" === typeof container.getRootNode) {
          var rootNode = container.getRootNode();
          if (9 === rootNode.nodeType || 11 === rootNode.nodeType) return rootNode;
        }
        return 9 === container.nodeType ? container : container.ownerDocument;
      }
      var previousDispatcher = ReactDOMSharedInternals.d;
      ReactDOMSharedInternals.d = {
        f: flushSyncWork,
        r: requestFormReset,
        D: prefetchDNS,
        C: preconnect,
        L: preload,
        m: preloadModule,
        X: preinitScript,
        S: preinitStyle,
        M: preinitModuleScript
      };
      function flushSyncWork() {
        var previousWasRendering = previousDispatcher.f(), wasRendering = flushSyncWork$1();
        return previousWasRendering || wasRendering;
      }
      function requestFormReset(form) {
        var formInst = getInstanceFromNode(form);
        null !== formInst && 5 === formInst.tag && "form" === formInst.type ? requestFormReset$1(formInst) : previousDispatcher.r(form);
      }
      var globalDocument = "undefined" === typeof document ? null : document;
      function preconnectAs(rel, href, crossOrigin) {
        var ownerDocument = globalDocument;
        if (ownerDocument && "string" === typeof href && href) {
          var limitedEscapedHref = escapeSelectorAttributeValueInsideDoubleQuotes(href);
          limitedEscapedHref = 'link[rel="' + rel + '"][href="' + limitedEscapedHref + '"]';
          "string" === typeof crossOrigin && (limitedEscapedHref += '[crossorigin="' + crossOrigin + '"]');
          preconnectsSet.has(limitedEscapedHref) || (preconnectsSet.add(limitedEscapedHref), rel = { rel, crossOrigin, href }, null === ownerDocument.querySelector(limitedEscapedHref) && (href = ownerDocument.createElement("link"), setInitialProperties(href, "link", rel), markNodeAsHoistable(href), ownerDocument.head.appendChild(href)));
        }
      }
      function prefetchDNS(href) {
        previousDispatcher.D(href);
        preconnectAs("dns-prefetch", href, null);
      }
      function preconnect(href, crossOrigin) {
        previousDispatcher.C(href, crossOrigin);
        preconnectAs("preconnect", href, crossOrigin);
      }
      function preload(href, as, options2) {
        previousDispatcher.L(href, as, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && href && as) {
          var preloadSelector = 'link[rel="preload"][as="' + escapeSelectorAttributeValueInsideDoubleQuotes(as) + '"]';
          "image" === as ? options2 && options2.imageSrcSet ? (preloadSelector += '[imagesrcset="' + escapeSelectorAttributeValueInsideDoubleQuotes(
            options2.imageSrcSet
          ) + '"]', "string" === typeof options2.imageSizes && (preloadSelector += '[imagesizes="' + escapeSelectorAttributeValueInsideDoubleQuotes(
            options2.imageSizes
          ) + '"]')) : preloadSelector += '[href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]' : preloadSelector += '[href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]';
          var key = preloadSelector;
          switch (as) {
            case "style":
              key = getStyleKey(href);
              break;
            case "script":
              key = getScriptKey(href);
          }
          if (!(preloadPropsMap.has(key) || (href = assign(
            {
              rel: "preload",
              href: "image" === as && options2 && options2.imageSrcSet ? void 0 : href,
              as
            },
            options2
          ), preloadPropsMap.set(key, href), null !== ownerDocument.querySelector(preloadSelector) || "style" === as && ownerDocument.querySelector(getStylesheetSelectorFromKey(key)) || "script" === as && ownerDocument.querySelector(getScriptSelectorFromKey(key))))) {
            var instance = ownerDocument.createElement("link");
            setInitialProperties(instance, "link", href);
            "style" === as && (instance[internalLoadPendingKey] = true, instance.onload = instance.onerror = function() {
              clearPendingLoadOnNode(instance);
            });
            markNodeAsHoistable(instance);
            ownerDocument.head.appendChild(instance);
          }
        }
      }
      function preloadModule(href, options2) {
        previousDispatcher.m(href, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && href) {
          var as = options2 && "string" === typeof options2.as ? options2.as : "script", preloadSelector = 'link[rel="modulepreload"][as="' + escapeSelectorAttributeValueInsideDoubleQuotes(as) + '"][href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]', key = preloadSelector;
          switch (as) {
            case "audioworklet":
            case "paintworklet":
            case "serviceworker":
            case "sharedworker":
            case "worker":
            case "script":
              key = getScriptKey(href);
          }
          if (!preloadPropsMap.has(key) && (href = assign({ rel: "modulepreload", href }, options2), preloadPropsMap.set(key, href), null === ownerDocument.querySelector(preloadSelector))) {
            switch (as) {
              case "audioworklet":
              case "paintworklet":
              case "serviceworker":
              case "sharedworker":
              case "worker":
              case "script":
                if (ownerDocument.querySelector(getScriptSelectorFromKey(key)))
                  return;
            }
            as = ownerDocument.createElement("link");
            setInitialProperties(as, "link", href);
            markNodeAsHoistable(as);
            ownerDocument.head.appendChild(as);
          }
        }
      }
      function preinitStyle(href, precedence, options2) {
        previousDispatcher.S(href, precedence, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && href) {
          var styles = getResourcesFromRoot(ownerDocument).hoistableStyles, key = getStyleKey(href);
          precedence = precedence || "default";
          var resource = styles.get(key);
          if (!resource) {
            var state = { loading: 0, preload: null };
            if (resource = ownerDocument.querySelector(
              getStylesheetSelectorFromKey(key)
            ))
              state.loading = 5;
            else {
              href = assign(
                { rel: "stylesheet", href, "data-precedence": precedence },
                options2
              );
              (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForStylesheet(href, options2);
              var link = resource = ownerDocument.createElement("link");
              markNodeAsHoistable(link);
              setInitialProperties(link, "link", href);
              link._p = new Promise(function(resolve, reject) {
                link.onload = resolve;
                link.onerror = reject;
              });
              link.addEventListener("load", function() {
                state.loading |= 1;
              });
              link.addEventListener("error", function() {
                state.loading |= 2;
              });
              state.loading |= 4;
              insertStylesheet(resource, precedence, ownerDocument);
            }
            resource = {
              type: "stylesheet",
              instance: resource,
              count: 1,
              state
            };
            styles.set(key, resource);
          }
        }
      }
      function preinitScript(src, options2) {
        previousDispatcher.X(src, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && src) {
          var scripts = getResourcesFromRoot(ownerDocument).hoistableScripts, key = getScriptKey(src), resource = scripts.get(key);
          resource || (resource = ownerDocument.querySelector(getScriptSelectorFromKey(key)), resource || (src = assign({ src, async: true }, options2), (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForScript(src, options2), resource = ownerDocument.createElement("script"), markNodeAsHoistable(resource), setInitialProperties(resource, "link", src), ownerDocument.head.appendChild(resource)), resource = {
            type: "script",
            instance: resource,
            count: 1,
            state: null
          }, scripts.set(key, resource));
        }
      }
      function preinitModuleScript(src, options2) {
        previousDispatcher.M(src, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && src) {
          var scripts = getResourcesFromRoot(ownerDocument).hoistableScripts, key = getScriptKey(src), resource = scripts.get(key);
          resource || (resource = ownerDocument.querySelector(getScriptSelectorFromKey(key)), resource || (src = assign({ src, async: true, type: "module" }, options2), (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForScript(src, options2), resource = ownerDocument.createElement("script"), markNodeAsHoistable(resource), setInitialProperties(resource, "link", src), ownerDocument.head.appendChild(resource)), resource = {
            type: "script",
            instance: resource,
            count: 1,
            state: null
          }, scripts.set(key, resource));
        }
      }
      function getResource(type, currentProps, pendingProps, currentResource) {
        var JSCompiler_inline_result = (JSCompiler_inline_result = rootInstanceStackCursor.current) ? getHoistableRoot(JSCompiler_inline_result) : null;
        if (!JSCompiler_inline_result) throw Error(formatProdErrorMessage(446));
        switch (type) {
          case "meta":
          case "title":
            return null;
          case "style":
            return "string" === typeof pendingProps.precedence && "string" === typeof pendingProps.href ? (pendingProps = getStyleKey(pendingProps.href), currentProps = getResourcesFromRoot(
              JSCompiler_inline_result
            ).hoistableStyles, currentResource = currentProps.get(pendingProps), currentResource || (currentResource = {
              type: "style",
              instance: null,
              count: 0,
              state: null
            }, currentProps.set(pendingProps, currentResource)), currentResource) : { type: "void", instance: null, count: 0, state: null };
          case "link":
            if ("stylesheet" === pendingProps.rel && "string" === typeof pendingProps.href && "string" === typeof pendingProps.precedence) {
              type = getStyleKey(pendingProps.href);
              var styles$268 = getResourcesFromRoot(
                JSCompiler_inline_result
              ).hoistableStyles, resource$269 = styles$268.get(type);
              resource$269 || (JSCompiler_inline_result = JSCompiler_inline_result.ownerDocument || JSCompiler_inline_result, resource$269 = {
                type: "stylesheet",
                instance: null,
                count: 0,
                state: { loading: 0, preload: null }
              }, styles$268.set(type, resource$269), (styles$268 = JSCompiler_inline_result.querySelector(
                getStylesheetSelectorFromKey(type)
              )) ? styles$268._p || (resource$269.instance = styles$268, resource$269.state.loading = 5) : (styles$268 = preloadPropsMap.get(type), styles$268 || (styles$268 = {
                rel: "preload",
                as: "style",
                href: pendingProps.href,
                crossOrigin: pendingProps.crossOrigin,
                integrity: pendingProps.integrity,
                media: pendingProps.media,
                hrefLang: pendingProps.hrefLang,
                referrerPolicy: pendingProps.referrerPolicy
              }, preloadPropsMap.set(type, styles$268)), preloadStylesheet(
                JSCompiler_inline_result,
                type,
                styles$268,
                resource$269.state
              )));
              if (currentProps && null === currentResource)
                throw Error(formatProdErrorMessage(528, ""));
              return resource$269;
            }
            if (currentProps && null !== currentResource)
              throw Error(formatProdErrorMessage(529, ""));
            return null;
          case "script":
            return currentProps = pendingProps.async, pendingProps = pendingProps.src, "string" === typeof pendingProps && currentProps && "function" !== typeof currentProps && "symbol" !== typeof currentProps ? (pendingProps = getScriptKey(pendingProps), currentProps = getResourcesFromRoot(
              JSCompiler_inline_result
            ).hoistableScripts, currentResource = currentProps.get(pendingProps), currentResource || (currentResource = {
              type: "script",
              instance: null,
              count: 0,
              state: null
            }, currentProps.set(pendingProps, currentResource)), currentResource) : { type: "void", instance: null, count: 0, state: null };
          default:
            throw Error(formatProdErrorMessage(444, type));
        }
      }
      function getStyleKey(href) {
        return 'href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"';
      }
      function getStylesheetSelectorFromKey(key) {
        return 'link[rel="stylesheet"][' + key + "]";
      }
      function stylesheetPropsFromRawProps(rawProps) {
        return assign({}, rawProps, {
          "data-precedence": rawProps.precedence,
          precedence: null
        });
      }
      function preloadStylesheet(ownerDocument, key, preloadProps, state) {
        if (key = ownerDocument.querySelector(
          'link[rel="preload"][as="style"][' + key + "]"
        )) {
          if (true !== key[internalLoadPendingKey]) {
            state.loading = 1;
            return;
          }
        } else
          key = ownerDocument.createElement("link"), key[internalLoadPendingKey] = true, key.onload = key.onerror = clearPendingLoadOnNode.bind(null, key), setInitialProperties(key, "link", preloadProps), markNodeAsHoistable(key), ownerDocument.head.appendChild(key);
        state.preload = key;
        key.addEventListener("load", function() {
          return state.loading |= 1;
        });
        key.addEventListener("error", function() {
          return state.loading |= 2;
        });
      }
      function getScriptKey(src) {
        return '[src="' + escapeSelectorAttributeValueInsideDoubleQuotes(src) + '"]';
      }
      function getScriptSelectorFromKey(key) {
        return "script[async]" + key;
      }
      function acquireResource(hoistableRoot, resource, props) {
        resource.count++;
        if (null === resource.instance)
          switch (resource.type) {
            case "style":
              var instance = hoistableRoot.querySelector(
                'style[data-href~="' + escapeSelectorAttributeValueInsideDoubleQuotes(props.href) + '"]'
              );
              if (instance)
                return resource.instance = instance, markNodeAsHoistable(instance), instance;
              var styleProps = assign({}, props, {
                "data-href": props.href,
                "data-precedence": props.precedence,
                href: null,
                precedence: null
              });
              instance = (hoistableRoot.ownerDocument || hoistableRoot).createElement(
                "style"
              );
              markNodeAsHoistable(instance);
              setInitialProperties(instance, "style", styleProps);
              insertStylesheet(instance, props.precedence, hoistableRoot);
              return resource.instance = instance;
            case "stylesheet":
              styleProps = getStyleKey(props.href);
              var instance$274 = hoistableRoot.querySelector(
                getStylesheetSelectorFromKey(styleProps)
              );
              if (instance$274)
                return resource.state.loading |= 4, resource.instance = instance$274, markNodeAsHoistable(instance$274), instance$274;
              instance = stylesheetPropsFromRawProps(props);
              (styleProps = preloadPropsMap.get(styleProps)) && adoptPreloadPropsForStylesheet(instance, styleProps);
              instance$274 = (hoistableRoot.ownerDocument || hoistableRoot).createElement("link");
              markNodeAsHoistable(instance$274);
              var linkInstance = instance$274;
              linkInstance._p = new Promise(function(resolve, reject) {
                linkInstance.onload = resolve;
                linkInstance.onerror = reject;
              });
              setInitialProperties(instance$274, "link", instance);
              resource.state.loading |= 4;
              insertStylesheet(instance$274, props.precedence, hoistableRoot);
              return resource.instance = instance$274;
            case "script":
              instance$274 = getScriptKey(props.src);
              if (styleProps = hoistableRoot.querySelector(
                getScriptSelectorFromKey(instance$274)
              ))
                return resource.instance = styleProps, markNodeAsHoistable(styleProps), styleProps;
              instance = props;
              if (styleProps = preloadPropsMap.get(instance$274))
                instance = assign({}, props), adoptPreloadPropsForScript(instance, styleProps);
              hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
              styleProps = hoistableRoot.createElement("script");
              markNodeAsHoistable(styleProps);
              setInitialProperties(styleProps, "link", instance);
              hoistableRoot.head.appendChild(styleProps);
              return resource.instance = styleProps;
            case "void":
              return null;
            default:
              throw Error(formatProdErrorMessage(443, resource.type));
          }
        else
          "stylesheet" === resource.type && 0 === (resource.state.loading & 4) && (instance = resource.instance, resource.state.loading |= 4, insertStylesheet(instance, props.precedence, hoistableRoot));
        return resource.instance;
      }
      function insertStylesheet(instance, precedence, root2) {
        for (var nodes = root2.querySelectorAll(
          'link[rel="stylesheet"][data-precedence],style[data-precedence]'
        ), last = nodes.length ? nodes[nodes.length - 1] : null, prior = last, i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          if (node.dataset.precedence === precedence) prior = node;
          else if (prior !== last) break;
        }
        prior ? prior.parentNode.insertBefore(instance, prior.nextSibling) : (precedence = 9 === root2.nodeType ? root2.head : root2, precedence.insertBefore(instance, precedence.firstChild));
      }
      function adoptPreloadPropsForStylesheet(stylesheetProps, preloadProps) {
        null == stylesheetProps.crossOrigin && (stylesheetProps.crossOrigin = preloadProps.crossOrigin);
        null == stylesheetProps.referrerPolicy && (stylesheetProps.referrerPolicy = preloadProps.referrerPolicy);
        null == stylesheetProps.title && (stylesheetProps.title = preloadProps.title);
      }
      function adoptPreloadPropsForScript(scriptProps, preloadProps) {
        null == scriptProps.crossOrigin && (scriptProps.crossOrigin = preloadProps.crossOrigin);
        null == scriptProps.referrerPolicy && (scriptProps.referrerPolicy = preloadProps.referrerPolicy);
        null == scriptProps.integrity && (scriptProps.integrity = preloadProps.integrity);
      }
      var tagCaches = null;
      function getHydratableHoistableCache(type, keyAttribute, ownerDocument) {
        if (null === tagCaches) {
          var cache = /* @__PURE__ */ new Map();
          var caches = tagCaches = /* @__PURE__ */ new Map();
          caches.set(ownerDocument, cache);
        } else
          caches = tagCaches, cache = caches.get(ownerDocument), cache || (cache = /* @__PURE__ */ new Map(), caches.set(ownerDocument, cache));
        if (cache.has(type)) return cache;
        cache.set(type, null);
        ownerDocument = ownerDocument.getElementsByTagName(type);
        for (caches = 0; caches < ownerDocument.length; caches++) {
          var node = ownerDocument[caches];
          if (!(node[internalHoistableMarker] || node[internalInstanceKey] || "link" === type && "stylesheet" === node.getAttribute("rel")) && "http://www.w3.org/2000/svg" !== node.namespaceURI) {
            var nodeKey = node.getAttribute(keyAttribute) || "";
            nodeKey = type + nodeKey;
            var existing = cache.get(nodeKey);
            existing ? existing.push(node) : cache.set(nodeKey, [node]);
          }
        }
        return cache;
      }
      function mountHoistable(hoistableRoot, type, instance) {
        hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
        hoistableRoot.head.insertBefore(
          instance,
          "title" === type ? hoistableRoot.querySelector("head > title") : null
        );
      }
      function isHostHoistableType(type, props, hostContext) {
        if (1 === hostContext || null != props.itemProp) return false;
        switch (type) {
          case "meta":
          case "title":
            return true;
          case "style":
            if ("string" !== typeof props.precedence || "string" !== typeof props.href || "" === props.href)
              break;
            return true;
          case "link":
            if ("string" !== typeof props.rel || "string" !== typeof props.href || "" === props.href || props.onLoad || props.onError)
              break;
            switch (props.rel) {
              case "stylesheet":
                return type = props.disabled, "string" === typeof props.precedence && null == type;
              default:
                return true;
            }
          case "script":
            if (props.async && "function" !== typeof props.async && "symbol" !== typeof props.async && !props.onLoad && !props.onError && props.src && "string" === typeof props.src)
              return true;
        }
        return false;
      }
      function maySuspendCommit(type, props) {
        return "img" === type && null != props.src && "" !== props.src && null == props.onLoad && "lazy" !== props.loading;
      }
      function preloadResource(resource) {
        return "stylesheet" === resource.type && 0 === (resource.state.loading & 3) ? false : true;
      }
      function estimateImageBytes(instance) {
        return (instance.width || 100) * (instance.height || 100) * ("number" === typeof devicePixelRatio ? devicePixelRatio : 1) * 0.25;
      }
      function suspendInstance(state, instance) {
        "function" === typeof instance.decode && (state.imgCount++, instance.complete || (state.imgBytes += estimateImageBytes(instance), state.suspenseyImages.push(instance)), state = onUnsuspendImg.bind(state), instance.decode().then(state, state));
      }
      function suspendResource(state, hoistableRoot, resource, props) {
        if ("stylesheet" === resource.type && ("string" !== typeof props.media || false !== matchMedia(props.media).matches) && 0 === (resource.state.loading & 4)) {
          if (null === resource.instance) {
            var key = getStyleKey(props.href), instance = hoistableRoot.querySelector(
              getStylesheetSelectorFromKey(key)
            );
            if (instance) {
              hoistableRoot = instance._p;
              null !== hoistableRoot && "object" === typeof hoistableRoot && "function" === typeof hoistableRoot.then && (state.count++, state = onUnsuspend.bind(state), hoistableRoot.then(state, state));
              resource.state.loading |= 4;
              resource.instance = instance;
              markNodeAsHoistable(instance);
              return;
            }
            instance = hoistableRoot.ownerDocument || hoistableRoot;
            props = stylesheetPropsFromRawProps(props);
            (key = preloadPropsMap.get(key)) && adoptPreloadPropsForStylesheet(props, key);
            instance = instance.createElement("link");
            markNodeAsHoistable(instance);
            var linkInstance = instance;
            linkInstance._p = new Promise(function(resolve, reject) {
              linkInstance.onload = resolve;
              linkInstance.onerror = reject;
            });
            setInitialProperties(instance, "link", props);
            resource.instance = instance;
          }
          null === state.stylesheets && (state.stylesheets = /* @__PURE__ */ new Map());
          state.stylesheets.set(resource, hoistableRoot);
          (hoistableRoot = resource.state.preload) && 0 === (resource.state.loading & 3) && (state.count++, resource = onUnsuspend.bind(state), hoistableRoot.addEventListener("load", resource), hoistableRoot.addEventListener("error", resource));
        }
      }
      var estimatedBytesWithinLimit = 0;
      function waitForCommitToBeReady(state, timeoutOffset) {
        state.stylesheets && 0 === state.count && insertSuspendedStylesheets(state, state.stylesheets);
        return 0 < state.count || 0 < state.imgCount ? function(commit) {
          var stylesheetTimer = setTimeout(function() {
            state.stylesheets && insertSuspendedStylesheets(state, state.stylesheets);
            if (state.unsuspend) {
              var unsuspend = state.unsuspend;
              state.unsuspend = null;
              unsuspend();
            }
          }, 6e4 + timeoutOffset);
          0 < state.imgBytes && 0 === estimatedBytesWithinLimit && (estimatedBytesWithinLimit = 62500 * estimateBandwidth());
          var imgTimer = setTimeout(
            function() {
              state.waitingForImages = false;
              if (0 === state.count && (state.stylesheets && insertSuspendedStylesheets(state, state.stylesheets), state.unsuspend)) {
                var unsuspend = state.unsuspend;
                state.unsuspend = null;
                unsuspend();
              }
            },
            (state.imgBytes > estimatedBytesWithinLimit ? 50 : 800) + timeoutOffset
          );
          state.unsuspend = commit;
          return function() {
            state.unsuspend = null;
            clearTimeout(stylesheetTimer);
            clearTimeout(imgTimer);
          };
        } : null;
      }
      function checkIfFullyUnsuspended(state) {
        if (0 === state.count && (0 === state.imgCount || !state.waitingForImages)) {
          if (state.stylesheets) insertSuspendedStylesheets(state, state.stylesheets);
          else if (state.unsuspend) {
            var unsuspend = state.unsuspend;
            state.unsuspend = null;
            unsuspend();
          }
        }
      }
      function onUnsuspend() {
        this.count--;
        checkIfFullyUnsuspended(this);
      }
      function onUnsuspendImg() {
        this.imgCount--;
        checkIfFullyUnsuspended(this);
      }
      var precedencesByRoot = null;
      function insertSuspendedStylesheets(state, resources) {
        state.stylesheets = null;
        null !== state.unsuspend && (state.count++, precedencesByRoot = /* @__PURE__ */ new Map(), resources.forEach(insertStylesheetIntoRoot, state), precedencesByRoot = null, onUnsuspend.call(state));
      }
      function insertStylesheetIntoRoot(root2, resource) {
        if (!(resource.state.loading & 4)) {
          var precedences = precedencesByRoot.get(root2);
          if (precedences) var last = precedences.get(null);
          else {
            precedences = /* @__PURE__ */ new Map();
            precedencesByRoot.set(root2, precedences);
            for (var nodes = root2.querySelectorAll(
              "link[data-precedence],style[data-precedence]"
            ), i = 0; i < nodes.length; i++) {
              var node = nodes[i];
              if ("LINK" === node.nodeName || "not all" !== node.getAttribute("media"))
                precedences.set(node.dataset.precedence, node), last = node;
            }
            last && precedences.set(null, last);
          }
          nodes = resource.instance;
          node = nodes.getAttribute("data-precedence");
          i = precedences.get(node) || last;
          i === last && precedences.set(null, nodes);
          precedences.set(node, nodes);
          this.count++;
          last = onUnsuspend.bind(this);
          nodes.addEventListener("load", last);
          nodes.addEventListener("error", last);
          i ? i.parentNode.insertBefore(nodes, i.nextSibling) : (root2 = 9 === root2.nodeType ? root2.head : root2, root2.insertBefore(nodes, root2.firstChild));
          resource.state.loading |= 4;
        }
      }
      var HostTransitionContext = {
        $$typeof: REACT_CONTEXT_TYPE,
        Provider: null,
        Consumer: null,
        _currentValue: sharedNotPendingObject,
        _currentValue2: sharedNotPendingObject,
        _threadCount: 0
      };
      function FiberRootNode(containerInfo, tag, hydrate, identifierPrefix, onUncaughtError, onCaughtError, onRecoverableError, onDefaultTransitionIndicator, formState) {
        this.tag = 1;
        this.containerInfo = containerInfo;
        this.pingCache = this.current = this.pendingChildren = null;
        this.timeoutHandle = -1;
        this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null;
        this.callbackPriority = 0;
        this.expirationTimes = createLaneMap(-1);
        this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0;
        this.entanglements = createLaneMap(0);
        this.hiddenUpdates = createLaneMap(null);
        this.identifierPrefix = identifierPrefix;
        this.onUncaughtError = onUncaughtError;
        this.onCaughtError = onCaughtError;
        this.onRecoverableError = onRecoverableError;
        this.pooledCache = null;
        this.pooledCacheLanes = 0;
        this.formState = formState;
        this.transitionTypes = null;
        this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function createFiberRoot(containerInfo, tag, hydrate, initialChildren, hydrationCallbacks, isStrictMode, identifierPrefix, formState, onUncaughtError, onCaughtError, onRecoverableError, onDefaultTransitionIndicator) {
        containerInfo = new FiberRootNode(
          containerInfo,
          tag,
          hydrate,
          identifierPrefix,
          onUncaughtError,
          onCaughtError,
          onRecoverableError,
          onDefaultTransitionIndicator,
          formState
        );
        tag = 1;
        true === isStrictMode && (tag |= 24);
        isStrictMode = createFiberImplClass(3, null, null, tag);
        containerInfo.current = isStrictMode;
        isStrictMode.stateNode = containerInfo;
        tag = createCache();
        tag.refCount++;
        containerInfo.pooledCache = tag;
        tag.refCount++;
        isStrictMode.memoizedState = {
          element: initialChildren,
          isDehydrated: hydrate,
          cache: tag
        };
        initializeUpdateQueue(isStrictMode);
        return containerInfo;
      }
      function getContextForSubtree(parentComponent) {
        if (!parentComponent) return emptyContextObject;
        parentComponent = emptyContextObject;
        return parentComponent;
      }
      function updateContainerImpl(rootFiber, lane, element, container, parentComponent, callback) {
        parentComponent = getContextForSubtree(parentComponent);
        null === container.context ? container.context = parentComponent : container.pendingContext = parentComponent;
        container = createUpdate(lane);
        container.payload = { element };
        callback = void 0 === callback ? null : callback;
        null !== callback && (container.callback = callback);
        element = enqueueUpdate(rootFiber, container, lane);
        null !== element && (scheduleUpdateOnFiber(element, rootFiber, lane), entangleTransitions(element, rootFiber, lane));
      }
      function markRetryLaneImpl(fiber, retryLane) {
        fiber = fiber.memoizedState;
        if (null !== fiber && null !== fiber.dehydrated) {
          var a = fiber.retryLane;
          fiber.retryLane = 0 !== a && a < retryLane ? a : retryLane;
        }
      }
      function markRetryLaneIfNotHydrated(fiber, retryLane) {
        markRetryLaneImpl(fiber, retryLane);
        (fiber = fiber.alternate) && markRetryLaneImpl(fiber, retryLane);
      }
      function attemptContinuousHydration(fiber) {
        if (13 === fiber.tag || 31 === fiber.tag) {
          var root2 = enqueueConcurrentRenderForLane(fiber, 67108864);
          null !== root2 && scheduleUpdateOnFiber(root2, fiber, 67108864);
          markRetryLaneIfNotHydrated(fiber, 67108864);
        }
      }
      function attemptHydrationAtCurrentPriority(fiber) {
        if (13 === fiber.tag || 31 === fiber.tag) {
          var lane = requestUpdateLane();
          lane = getBumpedLaneForHydrationByLane(lane);
          var root2 = enqueueConcurrentRenderForLane(fiber, lane);
          null !== root2 && scheduleUpdateOnFiber(root2, fiber, lane);
          markRetryLaneIfNotHydrated(fiber, lane);
        }
      }
      var _enabled = true;
      function dispatchDiscreteEvent(domEventName, eventSystemFlags, container, nativeEvent) {
        var prevTransition = ReactSharedInternals.T;
        ReactSharedInternals.T = null;
        var previousPriority = ReactDOMSharedInternals.p;
        try {
          ReactDOMSharedInternals.p = 2, dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
        } finally {
          ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition;
        }
      }
      function dispatchContinuousEvent(domEventName, eventSystemFlags, container, nativeEvent) {
        var prevTransition = ReactSharedInternals.T;
        ReactSharedInternals.T = null;
        var previousPriority = ReactDOMSharedInternals.p;
        try {
          ReactDOMSharedInternals.p = 8, dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
        } finally {
          ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition;
        }
      }
      function dispatchEvent(domEventName, eventSystemFlags, targetContainer, nativeEvent) {
        if (_enabled) {
          var blockedOn = findInstanceBlockingEvent(nativeEvent);
          if (null === blockedOn)
            dispatchEventForPluginEventSystem(
              domEventName,
              eventSystemFlags,
              nativeEvent,
              return_targetInst,
              targetContainer
            ), clearIfContinuousEvent(domEventName, nativeEvent);
          else if (queueIfContinuousEvent(
            blockedOn,
            domEventName,
            eventSystemFlags,
            targetContainer,
            nativeEvent
          ))
            nativeEvent.stopPropagation();
          else if (clearIfContinuousEvent(domEventName, nativeEvent), eventSystemFlags & 4 && -1 < discreteReplayableEvents.indexOf(domEventName)) {
            for (; null !== blockedOn; ) {
              var fiber = getInstanceFromNode(blockedOn);
              if (null !== fiber)
                switch (fiber.tag) {
                  case 3:
                    fiber = fiber.stateNode;
                    if (fiber.current.memoizedState.isDehydrated) {
                      var lanes = getHighestPriorityLanes(fiber.pendingLanes);
                      if (0 !== lanes) {
                        var root2 = fiber;
                        root2.pendingLanes |= 2;
                        for (root2.entangledLanes |= 2; lanes; ) {
                          var lane = 1 << 31 - clz32(lanes);
                          root2.entanglements[1] |= lane;
                          lanes &= ~lane;
                        }
                        ensureRootIsScheduled(fiber);
                        0 === (executionContext & 6) && (workInProgressRootRenderTargetTime = now() + 500, flushSyncWorkAcrossRoots_impl(0, false));
                      }
                    }
                    break;
                  case 31:
                  case 13:
                    root2 = enqueueConcurrentRenderForLane(fiber, 2), null !== root2 && scheduleUpdateOnFiber(root2, fiber, 2), flushSyncWork$1(), markRetryLaneIfNotHydrated(fiber, 2);
                }
              fiber = findInstanceBlockingEvent(nativeEvent);
              null === fiber && dispatchEventForPluginEventSystem(
                domEventName,
                eventSystemFlags,
                nativeEvent,
                return_targetInst,
                targetContainer
              );
              if (fiber === blockedOn) break;
              blockedOn = fiber;
            }
            null !== blockedOn && nativeEvent.stopPropagation();
          } else
            dispatchEventForPluginEventSystem(
              domEventName,
              eventSystemFlags,
              nativeEvent,
              null,
              targetContainer
            );
        }
      }
      function findInstanceBlockingEvent(nativeEvent) {
        nativeEvent = getEventTarget(nativeEvent);
        return findInstanceBlockingTarget(nativeEvent);
      }
      var return_targetInst = null;
      function findInstanceBlockingTarget(targetNode) {
        return_targetInst = null;
        targetNode = getClosestInstanceFromNode(targetNode);
        if (null !== targetNode) {
          var nearestMounted = getNearestMountedFiber(targetNode);
          if (null === nearestMounted) targetNode = null;
          else {
            var tag = nearestMounted.tag;
            if (13 === tag) {
              targetNode = getSuspenseInstanceFromFiber(nearestMounted);
              if (null !== targetNode) return targetNode;
              targetNode = null;
            } else if (31 === tag) {
              targetNode = getActivityInstanceFromFiber(nearestMounted);
              if (null !== targetNode) return targetNode;
              targetNode = null;
            } else if (3 === tag) {
              if (nearestMounted.stateNode.current.memoizedState.isDehydrated)
                return 3 === nearestMounted.tag ? nearestMounted.stateNode.containerInfo : null;
              targetNode = null;
            } else nearestMounted !== targetNode && (targetNode = null);
          }
        }
        return_targetInst = targetNode;
        return null;
      }
      function getEventPriority(domEventName) {
        switch (domEventName) {
          case "beforetoggle":
          case "cancel":
          case "click":
          case "close":
          case "contextmenu":
          case "copy":
          case "cut":
          case "auxclick":
          case "dblclick":
          case "dragend":
          case "dragstart":
          case "drop":
          case "focusin":
          case "focusout":
          case "input":
          case "invalid":
          case "keydown":
          case "keypress":
          case "keyup":
          case "mousedown":
          case "mouseup":
          case "paste":
          case "pause":
          case "play":
          case "pointercancel":
          case "pointerdown":
          case "pointerup":
          case "ratechange":
          case "reset":
          case "seeked":
          case "submit":
          case "toggle":
          case "touchcancel":
          case "touchend":
          case "touchstart":
          case "volumechange":
          case "change":
          case "selectionchange":
          case "textInput":
          case "compositionstart":
          case "compositionend":
          case "compositionupdate":
          case "beforeblur":
          case "afterblur":
          case "beforeinput":
          case "blur":
          case "fullscreenchange":
          case "fullscreenerror":
          case "focus":
          case "hashchange":
          case "popstate":
          case "select":
          case "selectstart":
            return 2;
          case "drag":
          case "dragenter":
          case "dragexit":
          case "dragleave":
          case "dragover":
          case "mousemove":
          case "mouseout":
          case "mouseover":
          case "pointermove":
          case "pointerout":
          case "pointerover":
          case "resize":
          case "scroll":
          case "touchmove":
          case "wheel":
          case "mouseenter":
          case "mouseleave":
          case "pointerenter":
          case "pointerleave":
            return 8;
          case "message":
            switch (getCurrentPriorityLevel()) {
              case ImmediatePriority:
                return 2;
              case UserBlockingPriority:
                return 8;
              case NormalPriority$1:
              case LowPriority:
                return 32;
              case IdlePriority:
                return 268435456;
              default:
                return 32;
            }
          default:
            return 32;
        }
      }
      var hasScheduledReplayAttempt = false;
      var queuedFocus = null;
      var queuedDrag = null;
      var queuedMouse = null;
      var queuedPointers = /* @__PURE__ */ new Map();
      var queuedPointerCaptures = /* @__PURE__ */ new Map();
      var queuedExplicitHydrationTargets = [];
      var discreteReplayableEvents = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
        " "
      );
      function clearIfContinuousEvent(domEventName, nativeEvent) {
        switch (domEventName) {
          case "focusin":
          case "focusout":
            queuedFocus = null;
            break;
          case "dragenter":
          case "dragleave":
            queuedDrag = null;
            break;
          case "mouseover":
          case "mouseout":
            queuedMouse = null;
            break;
          case "pointerover":
          case "pointerout":
            queuedPointers.delete(nativeEvent.pointerId);
            break;
          case "gotpointercapture":
          case "lostpointercapture":
            queuedPointerCaptures.delete(nativeEvent.pointerId);
        }
      }
      function accumulateOrCreateContinuousQueuedReplayableEvent(existingQueuedEvent, blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
        if (null === existingQueuedEvent || existingQueuedEvent.nativeEvent !== nativeEvent)
          return existingQueuedEvent = {
            blockedOn,
            domEventName,
            eventSystemFlags,
            nativeEvent,
            targetContainers: [targetContainer]
          }, null !== blockedOn && (blockedOn = getInstanceFromNode(blockedOn), null !== blockedOn && attemptContinuousHydration(blockedOn)), existingQueuedEvent;
        existingQueuedEvent.eventSystemFlags |= eventSystemFlags;
        blockedOn = existingQueuedEvent.targetContainers;
        null !== targetContainer && -1 === blockedOn.indexOf(targetContainer) && blockedOn.push(targetContainer);
        return existingQueuedEvent;
      }
      function queueIfContinuousEvent(blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
        switch (domEventName) {
          case "focusin":
            return queuedFocus = accumulateOrCreateContinuousQueuedReplayableEvent(
              queuedFocus,
              blockedOn,
              domEventName,
              eventSystemFlags,
              targetContainer,
              nativeEvent
            ), true;
          case "dragenter":
            return queuedDrag = accumulateOrCreateContinuousQueuedReplayableEvent(
              queuedDrag,
              blockedOn,
              domEventName,
              eventSystemFlags,
              targetContainer,
              nativeEvent
            ), true;
          case "mouseover":
            return queuedMouse = accumulateOrCreateContinuousQueuedReplayableEvent(
              queuedMouse,
              blockedOn,
              domEventName,
              eventSystemFlags,
              targetContainer,
              nativeEvent
            ), true;
          case "pointerover":
            var pointerId = nativeEvent.pointerId;
            queuedPointers.set(
              pointerId,
              accumulateOrCreateContinuousQueuedReplayableEvent(
                queuedPointers.get(pointerId) || null,
                blockedOn,
                domEventName,
                eventSystemFlags,
                targetContainer,
                nativeEvent
              )
            );
            return true;
          case "gotpointercapture":
            return pointerId = nativeEvent.pointerId, queuedPointerCaptures.set(
              pointerId,
              accumulateOrCreateContinuousQueuedReplayableEvent(
                queuedPointerCaptures.get(pointerId) || null,
                blockedOn,
                domEventName,
                eventSystemFlags,
                targetContainer,
                nativeEvent
              )
            ), true;
        }
        return false;
      }
      function attemptExplicitHydrationTarget(queuedTarget) {
        var targetInst = getClosestInstanceFromNode(queuedTarget.target);
        if (null !== targetInst) {
          var nearestMounted = getNearestMountedFiber(targetInst);
          if (null !== nearestMounted) {
            if (targetInst = nearestMounted.tag, 13 === targetInst) {
              if (targetInst = getSuspenseInstanceFromFiber(nearestMounted), null !== targetInst) {
                queuedTarget.blockedOn = targetInst;
                runWithPriority(queuedTarget.priority, function() {
                  attemptHydrationAtCurrentPriority(nearestMounted);
                });
                return;
              }
            } else if (31 === targetInst) {
              if (targetInst = getActivityInstanceFromFiber(nearestMounted), null !== targetInst) {
                queuedTarget.blockedOn = targetInst;
                runWithPriority(queuedTarget.priority, function() {
                  attemptHydrationAtCurrentPriority(nearestMounted);
                });
                return;
              }
            } else if (3 === targetInst && nearestMounted.stateNode.current.memoizedState.isDehydrated) {
              queuedTarget.blockedOn = 3 === nearestMounted.tag ? nearestMounted.stateNode.containerInfo : null;
              return;
            }
          }
        }
        queuedTarget.blockedOn = null;
      }
      function attemptReplayContinuousQueuedEvent(queuedEvent) {
        if (null !== queuedEvent.blockedOn) return false;
        for (var targetContainers = queuedEvent.targetContainers; 0 < targetContainers.length; ) {
          var nextBlockedOn = findInstanceBlockingEvent(queuedEvent.nativeEvent);
          if (null === nextBlockedOn) {
            nextBlockedOn = queuedEvent.nativeEvent;
            var nativeEventClone = new nextBlockedOn.constructor(
              nextBlockedOn.type,
              nextBlockedOn
            );
            currentReplayingEvent = nativeEventClone;
            nextBlockedOn.target.dispatchEvent(nativeEventClone);
            currentReplayingEvent = null;
          } else
            return targetContainers = getInstanceFromNode(nextBlockedOn), null !== targetContainers && attemptContinuousHydration(targetContainers), queuedEvent.blockedOn = nextBlockedOn, false;
          targetContainers.shift();
        }
        return true;
      }
      function attemptReplayContinuousQueuedEventInMap(queuedEvent, key, map) {
        attemptReplayContinuousQueuedEvent(queuedEvent) && map.delete(key);
      }
      function replayUnblockedEvents() {
        hasScheduledReplayAttempt = false;
        null !== queuedFocus && attemptReplayContinuousQueuedEvent(queuedFocus) && (queuedFocus = null);
        null !== queuedDrag && attemptReplayContinuousQueuedEvent(queuedDrag) && (queuedDrag = null);
        null !== queuedMouse && attemptReplayContinuousQueuedEvent(queuedMouse) && (queuedMouse = null);
        queuedPointers.forEach(attemptReplayContinuousQueuedEventInMap);
        queuedPointerCaptures.forEach(attemptReplayContinuousQueuedEventInMap);
      }
      function scheduleCallbackIfUnblocked(queuedEvent, unblocked) {
        queuedEvent.blockedOn === unblocked && (queuedEvent.blockedOn = null, hasScheduledReplayAttempt || (hasScheduledReplayAttempt = true, Scheduler.unstable_scheduleCallback(
          Scheduler.unstable_NormalPriority,
          replayUnblockedEvents
        )));
      }
      var lastScheduledReplayQueue = null;
      function scheduleReplayQueueIfNeeded(formReplayingQueue) {
        lastScheduledReplayQueue !== formReplayingQueue && (lastScheduledReplayQueue = formReplayingQueue, Scheduler.unstable_scheduleCallback(
          Scheduler.unstable_NormalPriority,
          function() {
            lastScheduledReplayQueue === formReplayingQueue && (lastScheduledReplayQueue = null);
            for (var i = 0; i < formReplayingQueue.length; i += 3) {
              var form = formReplayingQueue[i], submitterOrAction = formReplayingQueue[i + 1], formData = formReplayingQueue[i + 2];
              if ("function" !== typeof submitterOrAction)
                if (null === findInstanceBlockingTarget(submitterOrAction || form))
                  continue;
                else break;
              var formInst = getInstanceFromNode(form);
              null !== formInst && (formReplayingQueue.splice(i, 3), i -= 3, startHostTransition(
                formInst,
                {
                  pending: true,
                  data: formData,
                  method: form.method,
                  action: submitterOrAction
                },
                submitterOrAction,
                formData
              ));
            }
          }
        ));
      }
      function retryIfBlockedOn(unblocked) {
        function unblock(queuedEvent) {
          return scheduleCallbackIfUnblocked(queuedEvent, unblocked);
        }
        null !== queuedFocus && scheduleCallbackIfUnblocked(queuedFocus, unblocked);
        null !== queuedDrag && scheduleCallbackIfUnblocked(queuedDrag, unblocked);
        null !== queuedMouse && scheduleCallbackIfUnblocked(queuedMouse, unblocked);
        queuedPointers.forEach(unblock);
        queuedPointerCaptures.forEach(unblock);
        for (var i = 0; i < queuedExplicitHydrationTargets.length; i++) {
          var queuedTarget = queuedExplicitHydrationTargets[i];
          queuedTarget.blockedOn === unblocked && (queuedTarget.blockedOn = null);
        }
        for (; 0 < queuedExplicitHydrationTargets.length && (i = queuedExplicitHydrationTargets[0], null === i.blockedOn); )
          attemptExplicitHydrationTarget(i), null === i.blockedOn && queuedExplicitHydrationTargets.shift();
        i = (unblocked.ownerDocument || unblocked).$$reactFormReplay;
        if (null != i)
          for (queuedTarget = 0; queuedTarget < i.length; queuedTarget += 3) {
            var form = i[queuedTarget], submitterOrAction = i[queuedTarget + 1], formProps = form[internalPropsKey] || null;
            if ("function" === typeof submitterOrAction)
              formProps || scheduleReplayQueueIfNeeded(i);
            else if (formProps) {
              var action = null;
              if (submitterOrAction && submitterOrAction.hasAttribute("formAction"))
                if (form = submitterOrAction, formProps = submitterOrAction[internalPropsKey] || null)
                  action = formProps.formAction;
                else {
                  if (null !== findInstanceBlockingTarget(form)) continue;
                }
              else action = formProps.action;
              "function" === typeof action ? i[queuedTarget + 1] = action : (i.splice(queuedTarget, 3), queuedTarget -= 3);
              scheduleReplayQueueIfNeeded(i);
            }
          }
      }
      function defaultOnDefaultTransitionIndicator() {
        function handleNavigate(event) {
          event.canIntercept && "react-transition" === event.info && event.intercept({
            handler: function() {
              return new Promise(function(resolve) {
                return pendingResolve = resolve;
              });
            },
            focusReset: "manual",
            scroll: "manual"
          });
        }
        function handleNavigateComplete() {
          null !== pendingResolve && (pendingResolve(), pendingResolve = null);
          isCancelled || setTimeout(startFakeNavigation, 20);
        }
        function startFakeNavigation() {
          if (!isCancelled && !navigation.transition) {
            var currentEntry = navigation.currentEntry;
            currentEntry && null != currentEntry.url && navigation.navigate(currentEntry.url, {
              state: currentEntry.getState(),
              info: "react-transition",
              history: "replace"
            });
          }
        }
        if ("object" === typeof navigation) {
          var isCancelled = false, pendingResolve = null;
          navigation.addEventListener("navigate", handleNavigate);
          navigation.addEventListener("navigatesuccess", handleNavigateComplete);
          navigation.addEventListener("navigateerror", handleNavigateComplete);
          setTimeout(startFakeNavigation, 100);
          return function() {
            isCancelled = true;
            navigation.removeEventListener("navigate", handleNavigate);
            navigation.removeEventListener("navigatesuccess", handleNavigateComplete);
            navigation.removeEventListener("navigateerror", handleNavigateComplete);
            null !== pendingResolve && (pendingResolve(), pendingResolve = null);
          };
        }
      }
      function ReactDOMRoot(internalRoot) {
        this._internalRoot = internalRoot;
      }
      ReactDOMHydrationRoot.prototype.render = ReactDOMRoot.prototype.render = function(children) {
        var root2 = this._internalRoot;
        if (null === root2) throw Error(formatProdErrorMessage(409));
        var current = root2.current, lane = requestUpdateLane();
        updateContainerImpl(current, lane, children, root2, null, null);
      };
      ReactDOMHydrationRoot.prototype.unmount = ReactDOMRoot.prototype.unmount = function() {
        var root2 = this._internalRoot;
        if (null !== root2) {
          this._internalRoot = null;
          var container = root2.containerInfo;
          updateContainerImpl(root2.current, 2, null, root2, null, null);
          flushSyncWork$1();
          container[internalContainerInstanceKey] = null;
        }
      };
      function ReactDOMHydrationRoot(internalRoot) {
        this._internalRoot = internalRoot;
      }
      ReactDOMHydrationRoot.prototype.unstable_scheduleHydration = function(target) {
        if (target) {
          var updatePriority = resolveUpdatePriority();
          target = { blockedOn: null, target, priority: updatePriority };
          for (var i = 0; i < queuedExplicitHydrationTargets.length && 0 !== updatePriority && updatePriority < queuedExplicitHydrationTargets[i].priority; i++) ;
          queuedExplicitHydrationTargets.splice(i, 0, target);
          0 === i && attemptExplicitHydrationTarget(target);
        }
      };
      var isomorphicReactPackageVersion$jscomp$inline_2043 = React.version;
      if ("19.3.1" !== isomorphicReactPackageVersion$jscomp$inline_2043)
        throw Error(
          formatProdErrorMessage(
            527,
            isomorphicReactPackageVersion$jscomp$inline_2043,
            "19.3.1"
          )
        );
      ReactDOMSharedInternals.findDOMNode = function(componentOrElement) {
        var fiber = componentOrElement._reactInternals;
        if (void 0 === fiber) {
          if ("function" === typeof componentOrElement.render)
            throw Error(formatProdErrorMessage(188));
          componentOrElement = Object.keys(componentOrElement).join(",");
          throw Error(formatProdErrorMessage(268, componentOrElement));
        }
        componentOrElement = findCurrentFiberUsingSlowPath(fiber);
        componentOrElement = null !== componentOrElement ? findCurrentHostFiberImpl(componentOrElement) : null;
        componentOrElement = null === componentOrElement ? null : componentOrElement.stateNode;
        return componentOrElement;
      };
      var internals$jscomp$inline_2586 = {
        bundleType: 0,
        version: "19.3.1",
        rendererPackageName: "react-dom",
        currentDispatcherRef: ReactSharedInternals,
        reconcilerVersion: "19.3.1"
      };
      if ("undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) {
        hook$jscomp$inline_2587 = __REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (!hook$jscomp$inline_2587.isDisabled && hook$jscomp$inline_2587.supportsFiber)
          try {
            rendererID = hook$jscomp$inline_2587.inject(
              internals$jscomp$inline_2586
            ), injectedHook = hook$jscomp$inline_2587;
          } catch (err) {
          }
      }
      var hook$jscomp$inline_2587;
      exports.createRoot = function(container, options2) {
        if (!isValidContainer(container)) throw Error(formatProdErrorMessage(299));
        var isStrictMode = false, identifierPrefix = "", onUncaughtError = defaultOnUncaughtError, onCaughtError = defaultOnCaughtError, onRecoverableError = defaultOnRecoverableError;
        null !== options2 && void 0 !== options2 && (true === options2.unstable_strictMode && (isStrictMode = true), void 0 !== options2.identifierPrefix && (identifierPrefix = options2.identifierPrefix), void 0 !== options2.onUncaughtError && (onUncaughtError = options2.onUncaughtError), void 0 !== options2.onCaughtError && (onCaughtError = options2.onCaughtError), void 0 !== options2.onRecoverableError && (onRecoverableError = options2.onRecoverableError));
        options2 = createFiberRoot(
          container,
          1,
          false,
          null,
          null,
          isStrictMode,
          identifierPrefix,
          null,
          onUncaughtError,
          onCaughtError,
          onRecoverableError,
          defaultOnDefaultTransitionIndicator
        );
        container[internalContainerInstanceKey] = options2.current;
        listenToAllSupportedEvents(container);
        return new ReactDOMRoot(options2);
      };
      exports.hydrateRoot = function(container, initialChildren, options2) {
        if (!isValidContainer(container)) throw Error(formatProdErrorMessage(299));
        var isStrictMode = false, identifierPrefix = "", onUncaughtError = defaultOnUncaughtError, onCaughtError = defaultOnCaughtError, onRecoverableError = defaultOnRecoverableError, formState = null;
        null !== options2 && void 0 !== options2 && (true === options2.unstable_strictMode && (isStrictMode = true), void 0 !== options2.identifierPrefix && (identifierPrefix = options2.identifierPrefix), void 0 !== options2.onUncaughtError && (onUncaughtError = options2.onUncaughtError), void 0 !== options2.onCaughtError && (onCaughtError = options2.onCaughtError), void 0 !== options2.onRecoverableError && (onRecoverableError = options2.onRecoverableError), void 0 !== options2.formState && (formState = options2.formState));
        initialChildren = createFiberRoot(
          container,
          1,
          true,
          initialChildren,
          null != options2 ? options2 : null,
          isStrictMode,
          identifierPrefix,
          formState,
          onUncaughtError,
          onCaughtError,
          onRecoverableError,
          defaultOnDefaultTransitionIndicator
        );
        initialChildren.context = getContextForSubtree(null);
        options2 = initialChildren.current;
        isStrictMode = requestUpdateLane();
        isStrictMode = getBumpedLaneForHydrationByLane(isStrictMode);
        identifierPrefix = createUpdate(isStrictMode);
        identifierPrefix.callback = null;
        enqueueUpdate(options2, identifierPrefix, isStrictMode);
        options2 = isStrictMode;
        initialChildren.current.lanes = options2;
        markRootUpdated$1(initialChildren, options2);
        ensureRootIsScheduled(initialChildren);
        container[internalContainerInstanceKey] = initialChildren.current;
        listenToAllSupportedEvents(container);
        return new ReactDOMHydrationRoot(initialChildren);
      };
      exports.version = "19.3.1";
    }
  });

  // node_modules/react-dom/client.js
  var require_client = __commonJS({
    "node_modules/react-dom/client.js"(exports, module) {
      "use strict";
      function checkDCE() {
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
          return;
        }
        if (false) {
          throw new Error("^_^");
        }
        try {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
        } catch (err) {
          console.error(err);
        }
      }
      if (true) {
        checkDCE();
        module.exports = require_react_dom_client_production();
      } else {
        module.exports = null;
      }
    }
  });

  // node_modules/react/cjs/react-jsx-runtime.production.js
  var require_react_jsx_runtime_production = __commonJS({
    "node_modules/react/cjs/react-jsx-runtime.production.js"(exports) {
      "use strict";
      var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element");
      var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
      function jsxProd(type, config, maybeKey) {
        var key = null;
        void 0 !== maybeKey && (key = "" + maybeKey);
        void 0 !== config.key && (key = "" + config.key);
        if ("key" in config) {
          maybeKey = {};
          for (var propName in config)
            "key" !== propName && (maybeKey[propName] = config[propName]);
        } else maybeKey = config;
        config = maybeKey.ref;
        return {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key,
          ref: void 0 !== config ? config : null,
          props: maybeKey
        };
      }
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.jsx = jsxProd;
      exports.jsxs = jsxProd;
    }
  });

  // node_modules/react/jsx-runtime.js
  var require_jsx_runtime = __commonJS({
    "node_modules/react/jsx-runtime.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_react_jsx_runtime_production();
      } else {
        module.exports = null;
      }
    }
  });

  // src/standalone.jsx
  var import_client = __toESM(require_client(), 1);

  // src/client.jsx
  var import_react = __toESM(require_react(), 1);
  var import_react_dom = __toESM(require_react_dom(), 1);

  // core/todo.mjs
  function parseTodos(md) {
    const items = [];
    md.split(/\r?\n/u).forEach((line, idx) => {
      const match = line.match(/^(\s*)- \[( |x|X)\] (.+)$/u);
      if (!match) return;
      let rest = match[3];
      const due = (rest.match(/@(\d{4}-\d{2}-\d{2})/u) || [])[1] || null;
      const tags = [...rest.matchAll(/#([^\s#@]+)/gu)].map((hit) => hit[1]);
      rest = rest.replace(/@(\d{4}-\d{2}-\d{2})/gu, "").replace(/#([^\s#@]+)/gu, "").trim();
      items.push({ line: idx, done: match[2].toLowerCase() === "x", text: rest, tags, due });
    });
    return items;
  }
  function serializeTodos(items, original) {
    const lines = original.split(/\r?\n/u);
    const byLine = new Map(items.filter((item) => item.line >= 0).map((item) => [item.line, item]));
    const fresh = items.filter((item) => item.line < 0);
    const meta = (item) => {
      const tags = item.tags.map((tag) => `#${tag}`).join(" ");
      return (tags ? ` ${tags}` : "") + (item.due ? ` @${item.due}` : "");
    };
    const out = lines.map((line, index) => {
      const item = byLine.get(index);
      return item ? `- [${item.done ? "x" : " "}] ${item.text}${meta(item)}` : line;
    });
    for (const item of fresh) out.push(`- [ ] ${item.text}${meta(item)}`);
    while (out.length && out[out.length - 1] === "") out.pop();
    return `${out.join("\n")}
`;
  }

  // src/client.jsx
  var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
  var API = "/api/pwb-lite";
  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      headers: { "Content-Type": "application/json" },
      ...opts
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      if (res.status === 409 && data.currentText !== void 0) {
        err.currentText = data.currentText;
        err.currentHash = data.currentHash;
      }
      if (res.status === 409 && data.currentNav !== void 0) {
        err.currentNav = data.currentNav;
        err.currentHash = data.currentHash;
      }
      throw err;
    }
    return data;
  }
  var rid = () => Math.random().toString(36).slice(2, 9);
  var esc = (s) => String(s ?? "");
  var pad2 = (n) => String(n).padStart(2, "0");
  var today = () => {
    const d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  var fromISO = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  var isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  var mondayOf = (d) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - (x.getDay() + 6) % 7);
    return x;
  };
  var addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  var ICON_PATHS = {
    rocket: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" })
    ] }),
    check: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 6 9 17l-5-5" }),
    checkCircle: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "9.5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m8.4 12.3 2.5 2.5 4.7-5.2" })
    ] }),
    compass: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "9.5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m15.7 8.3-1.95 5.45L8.3 15.7l1.95-5.45z" })
    ] }),
    server: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2.5", y: "3", width: "19", height: "7.5", rx: "2" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2.5", y: "13.5", width: "19", height: "7.5", rx: "2" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.3 6.75h.01M6.3 17.25h.01" })
    ] }),
    sun: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "4" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" })
    ] }),
    moon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" }),
    contrast: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "9.5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 2.5v19a9.5 9.5 0 0 0 0-19z", fill: "currentColor", stroke: "none" })
    ] }),
    sliders: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 6h7M17 6h3M4 12h3M13 12h7M4 18h7M17 18h3" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "14", cy: "6", r: "2.2" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "10", cy: "12", r: "2.2" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "14", cy: "18", r: "2.2" })
    ] }),
    star: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m12 3 2.65 5.9 6.35.6-4.8 4.25 1.4 6.25L12 16.7 6.4 20l1.4-6.25L3 9.5l6.35-.6z" }),
    trash: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 6.5h16" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M18.5 6.5v12a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-12" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 6.5v-2A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5v2" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10 11v6M14 11v6" })
    ] }),
    edit: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m15 5 4 4" })
    ] }),
    copy: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "9", y: "9", width: "12", height: "12", rx: "2.5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
    ] }),
    eye: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "3" })
    ] }),
    file: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15 2v6h6" })
    ] }),
    plus: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 5v14M5 12h14" }),
    x: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M17 7 7 17M7 7l10 10" }),
    search: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "11", cy: "11", r: "7" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m20.5 20.5-4.6-4.6" })
    ] }),
    link: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9.6 13.4a4.1 4.1 0 0 0 6.14.44l2.55-2.55a4.1 4.1 0 0 0-5.8-5.8l-1.47 1.46" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M14.4 10.6a4.1 4.1 0 0 0-6.14-.44l-2.55 2.55a4.1 4.1 0 0 0 5.8 5.8l1.46-1.46" })
    ] }),
    chevronLeft: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m14.5 18-6-6 6-6" }),
    chevronRight: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m9.5 18 6-6-6-6" }),
    clock: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "9.5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 7v5l3.2 1.9" })
    ] }),
    calendar: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3.5", y: "5", width: "17", height: "16", rx: "2.5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 3v4M16 3v4M3.5 10.5h17" })
    ] }),
    refresh: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 3v5h-5" })
    ] }),
    folder: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" }),
    lock: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "4", y: "10.5", width: "16", height: "10.5", rx: "2.5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 10.5V7a4 4 0 0 1 8 0v3.5" })
    ] }),
    unlock: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "4", y: "10.5", width: "16", height: "10.5", rx: "2.5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 10.5V7a4 4 0 0 1 7.83-1.32" })
    ] }),
    alert: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "9.5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 7.5V13M12 16.5h.01" })
    ] }),
    flame: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" }),
    dot: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "4.5", fill: "currentColor", stroke: "none" }),
    archive: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "4", width: "18", height: "4.5", rx: "1.2" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 8.5V19a1.6 1.6 0 0 0 1.6 1.6h10.8A1.6 1.6 0 0 0 19 19V8.5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10 12.5h4" })
    ] })
  };
  function Icon({ name, size = 16, filled = false, className = "" }) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "svg",
      {
        className: "pwb-ic " + className,
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: filled ? "currentColor" : "none",
        stroke: "currentColor",
        strokeWidth: "1.7",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        children: ICON_PATHS[name]
      }
    );
  }
  var letterAvatar = (name) => {
    const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    const ch = (name[0] || "?").toUpperCase();
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},72%,60%)'/><stop offset='1' stop-color='hsl(${(hue + 46) % 360},68%,44%)'/></linearGradient></defs><rect width='32' height='32' rx='8' fill='url(#g)'/><text x='16' y='22' font-size='15' font-family='sans-serif' font-weight='600' fill='white' text-anchor='middle'>${ch}</text></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  };
  var BrandMark = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "20", height: "20", viewBox: "0 0 24 24", "aria-hidden": "true", style: { flexShrink: 0 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", { id: "pwb-brand-g", x1: "0", y1: "0", x2: "1", y2: "1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "0", stopColor: "#4da3ff" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "1", stopColor: "#0053b8" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "1.5", y: "1.5", width: "21", height: "21", rx: "6.3", fill: "url(#pwb-brand-g)" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "5", y: "6", width: "14", height: "12", rx: "2.5", fill: "rgba(255,255,255,.96)" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "7.7", cy: "8.6", r: "0.95", fill: "#ff5f57" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "10.3", cy: "8.6", r: "0.95", fill: "#febc2e" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12.9", cy: "8.6", r: "0.95", fill: "#28c840" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "7", y: "11.2", width: "10", height: "1.6", rx: "0.8", fill: "#c8cdd5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "7", y: "14.2", width: "6.5", height: "1.6", rx: "0.8", fill: "#dde2e9" })
  ] });
  var I18N = {
    zh: {
      app_name: "\u4E2A\u4EBA\u5DE5\u4F5C\u53F0",
      tab_apps: "\u5E94\u7528",
      tab_todo: "\u5F85\u529E",
      tab_nav: "\u5BFC\u822A",
      tab_assets: "\u8D44\u4EA7",
      appearance: "\u5916\u89C2",
      auto: "\u81EA\u52A8",
      light: "\u6D45\u8272",
      dark: "\u6DF1\u8272",
      theme_color: "\u4E3B\u9898\u8272",
      blue: "\u7ECF\u5178\u84DD",
      pink: "\u6A31\u82B1\u7C89",
      language: "\u8BED\u8A00",
      autostart: "\u5F00\u673A\u81EA\u542F",
      autostart_tip: "\u767B\u5F55 Windows \u540E\u81EA\u52A8\u5728\u540E\u53F0\u62C9\u8D77\u670D\u52A1\uFF08\u4E0D\u6253\u5F00\u9875\u9762\uFF09\uFF1B\u4EC5\u5F53\u524D\u7528\u6237\uFF0C\u5199 HKCU Run \u952E",
      conn_lost: "\u670D\u52A1\u8FDE\u63A5\u65AD\u5F00\uFF0C\u81EA\u52A8\u91CD\u8FDE\u4E2D\u2026",
      conn_restored: "\u670D\u52A1\u5DF2\u6062\u590D\uFF0C\u6B63\u5728\u5237\u65B0",
      vault_remember: "\u5728\u672C\u673A\u8BB0\u4F4F\uFF0C\u91CD\u542F\u540E\u81EA\u52A8\u89E3\u9501",
      tab_note: "\u901F\u8BB0",
      tab_keys: "\u5BC6\u94A5\u6587\u6863",
      kd_new: "\u65B0\u5EFA\u6587\u6863",
      kd_name_ph: "\u6587\u6863\u540D\u79F0",
      kd_del: "\u5220\u9664\u6587\u6863",
      kd_del_msg: "\u5220\u9664\u300C{name}\u300D\uFF1F\u6587\u4EF6\u5C06\u6C38\u4E45\u79FB\u9664\u3002",
      kd_back: "\u8FD4\u56DE\u5217\u8868",
      kd_conflict: "\u6587\u6863\u5DF2\u88AB\u5916\u90E8\u4FEE\u6539\uFF0C\u5DF2\u52A0\u8F7D\u6700\u65B0\u5185\u5BB9\uFF0C\u8BF7\u91CD\u8BD5",
      kd_saved: "\u5DF2\u4FDD\u5B58",
      kd_created: "\u5DF2\u521B\u5EFA",
      kd_deleted: "\u5DF2\u5220\u9664",
      kd_search: "\u641C\u7D22\u6587\u6863\u2026",
      kd_chars: "{chars} \u5B57",
      kd_empty_list: "\u8FD8\u6CA1\u6709\u5BC6\u94A5\u6587\u6863",
      kd_empty_doc: "\u7A7A\u6587\u6863\uFF0C\u70B9\u300C\u7F16\u8F91\u300D\u5F00\u59CB\u8BB0\u5F55",
      kd_open_tip: "\u70B9\u51FB\u6253\u5F00\u6587\u6863",
      kd_name_exists: "\u540C\u540D\u6587\u6863\u5DF2\u5B58\u5728",
      kd_add_title: "\u6DFB\u52A0\u5BC6\u94A5\u6587\u6863",
      kd_or: "\u6216",
      kd_import_file: "\u5BFC\u5165 .md / .txt \u6587\u4EF6",
      kd_import_hint: "\u9009\u62E9\u672C\u5730\u7684 Markdown \u6216\u7EAF\u6587\u672C\u6587\u4EF6\uFF0C\u5185\u5BB9\u539F\u6837\u4FDD\u5B58\u4E3A\u5BC6\u94A5\u6587\u6863",
      kd_import_done: "\u5DF2\u5BFC\u5165\uFF1A{name}",
      kd_bad_file: "\u4EC5\u652F\u6301 .md / .txt \u6587\u4EF6",
      kd_too_big: "\u6587\u4EF6\u8D85\u8FC7 1 MB \u4E0A\u9650",
      note_earlier: "\u66F4\u65E9",
      tab_ai: "AI",
      ai_title: "AI \u52A9\u624B",
      ai_ph: "\u8F93\u5165\u6D88\u606F\uFF0CEnter \u53D1\u9001 / Shift+Enter \u6362\u884C",
      ai_send: "\u53D1\u9001",
      ai_config: "AI \u8BBE\u7F6E",
      ai_provider: "\u4F9B\u5E94\u5546",
      ai_mode: "\u63A5\u5165\u65B9\u5F0F",
      ai_baseurl: "\u63A5\u53E3\u5730\u5740",
      ai_key: "API \u5BC6\u94A5",
      ai_model: "\u6A21\u578B",
      ai_test: "\u6D4B\u8BD5\u8FDE\u63A5",
      ai_testing: "\u6D4B\u8BD5\u4E2D\u2026",
      ai_test_ok: "\u2705 \u8FDE\u63A5\u6B63\u5E38 \xB7 {ms}ms",
      ai_test_fail: "\u274C \u8FDE\u63A5\u5931\u8D25\uFF1A",
      ai_models: "\u6A21\u578B\u5217\u8868\uFF08\u9017\u53F7\u5206\u9694\uFF0C\u53EF\u914D\u591A\u4E2A\uFF09",
      ai_model_ph: "\u8F93\u5165\u6A21\u578B ID \u540E\u56DE\u8F66\u6DFB\u52A0",
      add_model: "\u6DFB\u52A0",
      ai_cfg_saved: "AI \u914D\u7F6E\u5DF2\u4FDD\u5B58",
      ai_key_keep: "\u5DF2\u4FDD\u5B58\uFF08\u7559\u7A7A\u4E0D\u4FEE\u6539\uFF09",
      ai_need_cfg_first: "\u8BF7\u5148\u70B9\u53F3\u4E0A\u89D2 \u2699 \u914D\u7F6E\u6A21\u578B\u63A5\u53E3",
      ai_new_session: "\u65B0\u4F1A\u8BDD",
      ai_new_session_msg: "\u6E05\u7A7A\u5F53\u524D\u4F1A\u8BDD\u5E76\u5F00\u59CB\u65B0\u5BF9\u8BDD\uFF1F",
      ai_welcome: "\u6211\u662F\u5DE5\u4F5C\u53F0 AI \u52A9\u624B\uFF1A\u53EF\u67E5\u8BE2\u4F60\u7684\u5F85\u529E\u3001\u901F\u8BB0\u3001\u670D\u52A1\u5668\u8D44\u4EA7\u4E0E\u5BFC\u822A\u3002\u5148\u5728\u53F3\u4E0A\u89D2 \u2699 \u914D\u7F6E\u6A21\u578B\u63A5\u53E3\uFF0C\u7136\u540E\u76F4\u63A5\u63D0\u95EE\u3002",
      ai_ready_hint: "\u5DF2\u5C31\u7EEA",
      ai_asset_btn: "AI \u5BF9\u8BDD",
      ai_new_chat: "\u65B0\u5EFA\u5BF9\u8BDD",
      ai_no_sessions: "\u6682\u65E0\u4F1A\u8BDD",
      ai_del_session: "\u5220\u9664\u4F1A\u8BDD",
      ai_sessions_view: "\u4F1A\u8BDD",
      ai_archived_view: "\u5DF2\u5F52\u6863",
      ai_archive: "\u5F52\u6863",
      ai_unarchive: "\u6062\u590D",
      ai_persist_fail: "\u4F1A\u8BDD\u4FDD\u5B58\u5931\u8D25\uFF1A",
      ai_del_session_msg: "\u5220\u9664\u4F1A\u8BDD\u300C{name}\u300D\uFF1F\u804A\u5929\u8BB0\u5F55\u5C06\u4E00\u5E76\u6E05\u9664\u3002",
      ai_sessions: "\u4F1A\u8BDD",
      ai_ctx_label: "\u5BF9\u8BDD\u5BF9\u8C61",
      ai_ctx_clear: "\u9000\u51FA\u8D44\u4EA7\u5BF9\u8BDD",
      confirm_approve: "\u6279\u51C6",
      confirm_reject: "\u62D2\u7EDD",
      confirm_title: "\u9700\u8981\u4F60\u786E\u8BA4\u624D\u80FD\u6267\u884C",
      ai_tool_read_todo: "\u8BFB\u53D6\u5F85\u529E",
      ai_tool_read_note: "\u8BFB\u53D6\u901F\u8BB0",
      ai_tool_list_assets: "\u8BFB\u53D6\u8D44\u4EA7\u6E05\u5355",
      ai_tool_probe_asset: "\u63A2\u6D4B\u670D\u52A1\u5668",
      ai_tool_search_nav: "\u641C\u7D22\u5BFC\u822A",
      ai_tool_list_keydocs: "\u5217\u51FA\u5BC6\u94A5\u6587\u6863",
      note_new: "\u65B0\u5EFA\u5361\u7247",
      note_ph: "\u60F3\u5230\u4EC0\u4E48\u8BB0\u4EC0\u4E48\uFF0C\u56DE\u8F66\u5373\u5B58",
      note_add: "\u8BB0\u4E00\u7B14",
      note_raw: "\u6574\u7BC7\u7F16\u8F91",
      note_raw_save: "\u4FDD\u5B58\u6574\u7BC7",
      note_raw_cancel: "\u653E\u5F03",
      note_search: "\u641C\u7D22\u7B14\u8BB0\u2026",
      note_empty: "\u8FD8\u6CA1\u6709\u7B14\u8BB0\uFF0C\u5148\u8BB0\u4E00\u6761",
      note_none_match: "\u6CA1\u6709\u5339\u914D\u7684\u7B14\u8BB0",
      note_del: "\u5220\u9664",
      note_edit: "\u7F16\u8F91",
      note_save: "\u4FDD\u5B58",
      note_cancel: "\u53D6\u6D88",
      note_stats: "{entries} \u6761 \xB7 {chars} \u5B57",
      note_conflict: "\u901F\u8BB0\u5DF2\u88AB\u5916\u90E8\u4FEE\u6539\uFF08\u5982 Obsidian\uFF09\uFF0C\u5DF2\u52A0\u8F7D\u6700\u65B0\u5185\u5BB9\uFF0C\u8BF7\u91CD\u8BD5",
      key_search: "\u641C\u7D22\u540D\u79F0\u3001\u5730\u5740\u3001\u5BC6\u94A5\u2026",
      key_add: "\u6DFB\u52A0\u6761\u76EE",
      key_import: "\u5BFC\u5165\u6587\u672C",
      key_import_title: "\u5BFC\u5165\u5DF2\u6709\u5BC6\u94A5\u6587\u672C",
      key_import_ph: "\u7C98\u8D34\u73B0\u6709\u5BC6\u94A5\u6587\u6863\uFF08\u652F\u6301 # / ## \u6807\u9898\u4F5C\u4E3A\u6761\u76EE\u540D\uFF0C\u81EA\u52A8\u6309\u6807\u9898\u5207\u5206\uFF09",
      key_import_apply: "\u5BFC\u5165",
      key_imported: "\u5DF2\u5BFC\u5165 {n} \u6761",
      key_export: "\u5BFC\u51FA",
      key_empty: "\u8FD8\u6CA1\u6709\u6761\u76EE\uFF0C\u70B9\u300C\u6DFB\u52A0\u6761\u76EE\u300D\u6216\u300C\u5BFC\u5165\u6587\u672C\u300D\u5F00\u59CB",
      key_none_match: "\u6CA1\u6709\u5339\u914D\u7684\u6587\u6863",
      key_del_title: "\u5220\u9664\u6761\u76EE",
      key_del_msg: "\u5220\u9664\u300C{name}\u300D\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002",
      key_add_title: "\u6DFB\u52A0\u6761\u76EE",
      key_edit_title: "\u7F16\u8F91\u6761\u76EE",
      key_f_name: "\u540D\u79F0",
      key_add_field: "\u52A0\u5B57\u6BB5",
      key_raw: "\u539F\u6587\u884C\uFF08\u53EF\u9009\uFF0C\u539F\u6837\u4FDD\u7559\uFF09",
      key_conflict: "\u5BC6\u94A5.md \u5DF2\u88AB\u5916\u90E8\u4FEE\u6539\uFF08\u5982 Obsidian\uFF09\uFF0C\u5DF2\u52A0\u8F7D\u6700\u65B0\u5185\u5BB9\uFF0C\u8BF7\u91CD\u8BD5",
      key_all: "\u5168\u90E8",
      search_apps: "\u641C\u7D22 {n} \u4E2A\u5E94\u7528\u2026",
      open_folder: "\u6253\u5F00\u76EE\u5F55",
      refresh: "\u5237\u65B0",
      set_folder: "\u8BBE\u7F6E\u76EE\u5F55",
      dir_line: "\u76EE\u5F55 {dir} \xB7 \u5355\u51FB\u542F\u52A8\uFF0C\u2606 \u7F6E\u9876 / \u2605 \u53D6\u6D88\u7F6E\u9876",
      dir_missing: "\u5E94\u7528\u76EE\u5F55\u4E0D\u5B58\u5728\uFF1A{dir}\uFF0C\u70B9\u300C\u8BBE\u7F6E\u76EE\u5F55\u300D\u4FEE\u6539",
      dir_unset: "\u672A\u914D\u7F6E\u5E94\u7528\u76EE\u5F55\uFF0C\u70B9\u300C\u8BBE\u7F6E\u76EE\u5F55\u300D\u6307\u5B9A\u5B58\u653E\u5FEB\u6377\u65B9\u5F0F\u7684\u6587\u4EF6\u5939",
      pinned: "\u7F6E\u9876",
      all_apps: "\u5168\u90E8\u5E94\u7528",
      missing_tag: "\u5DF2\u5931\u6548",
      pin_title: "\u7F6E\u9876",
      unpin_title: "\u53D6\u6D88\u7F6E\u9876",
      card_title: "{file} \xB7 \u5355\u51FB\u542F\u52A8",
      missing_title: "{file} \xB7 \u6587\u4EF6\u4E0D\u5B58\u5728\uFF08\u53EF\u80FD\u5DF2\u6539\u540D\u6216\u79FB\u52A8\uFF09\uFF0C\u70B9 \u2605 \u53D6\u6D88\u7F6E\u9876",
      empty_apps: "\u76EE\u5F55\u91CC\u8FD8\u6CA1\u6709 .lnk / .url \u5FEB\u6377\u65B9\u5F0F\u3002\u628A\u684C\u9762\u6216\u5F00\u59CB\u83DC\u5355\u7684\u5FEB\u6377\u65B9\u5F0F\u590D\u5236\u8FDB\u76EE\u5F55\u5373\u53EF\u5728\u8FD9\u91CC\u4E00\u952E\u542F\u52A8\u3002",
      no_match: "\u6CA1\u6709\u5339\u914D\u300C{q}\u300D\u7684\u5E94\u7528",
      launched: "\u5DF2\u542F\u52A8\uFF1A{name}",
      dir_updated: "\u5E94\u7528\u76EE\u5F55\u5DF2\u66F4\u65B0",
      set_dir_title: "\u5E94\u7528\u76EE\u5F55",
      set_dir_msg: "\u5B58\u653E .lnk / .url \u5FEB\u6377\u65B9\u5F0F\u7684\u6587\u4EF6\u5939\uFF08\u7EDD\u5BF9\u8DEF\u5F84\uFF0C\u7559\u7A7A\u6062\u590D\u9ED8\u8BA4\uFF09",
      todo_ph: "\u65B0\u5F85\u529E\uFF1A\u53EF\u5E26 #\u6807\u7B7E \u4E0E @2026-10-27 \u622A\u6B62\u65E5\uFF0C\u56DE\u8F66\u6DFB\u52A0",
      cal_add_tip: "\u5728\u8FD9\u5929\u6DFB\u52A0\u5F85\u529E",
      add: "\u6DFB\u52A0",
      view_board: "\u770B\u677F",
      view_cal: "\u65E5\u5386",
      view_track: "\u8DDF\u8E2A",
      stored_at: "\u5B58\u50A8\u4E8E {path}\uFF08Markdown \u6E05\u5355\uFF0CObsidian \u53EF\u7F16\u8F91\u540C\u4E00\u4EFD\u6587\u4EF6\uFF09",
      overdue: "\u903E\u671F",
      inprog: "\u8FDB\u884C\u4E2D",
      done: "\u5DF2\u5B8C\u6210",
      no_overdue: "\u6682\u65E0\u903E\u671F",
      no_inprog: "\u6682\u65E0\u8FDB\u884C\u4E2D",
      no_done: "\u8FD8\u6CA1\u6709\u5B8C\u6210\u7684\u5F85\u529E",
      scope_today: "\u4ECA\u5929",
      scope_week: "\u672C\u5468",
      scope_month: "\u672C\u6708",
      all: "\u5168\u90E8",
      seg_week: "\u5468",
      seg_month: "\u6708",
      show_done: "\u770B\u5DF2\u5B8C\u6210",
      none_in_range: "\u8FD9\u4E2A\u8303\u56F4\u91CC\u6CA1\u6709\u5F85\u529E",
      legend_open: "\u672A\u5B8C\u6210",
      legend_drag: " \u62D6\u5230\u5176\u4ED6\u65E5\u671F\u53EF\u6539\u671F",
      legend_overdue: "\u903E\u671F",
      legend_done: "\u2713 \u5DF2\u5B8C\u6210",
      legend_done_note: " \u4ECD\u843D\u5728\u622A\u6B62\u65E5",
      del: "\u5220\u9664",
      click_select: "\u70B9\u51FB\u9009\u4E2D",
      chip_title: "{text}\uFF08\u62D6\u5230\u5176\u4ED6\u65E5\u671F\u53EF\u6539\u671F\uFF0C\u70B9\u51FB\u52FE\u9009\u5B8C\u6210\uFF09",
      chip_title_done: "{text}\uFF08\u5DF2\u5B8C\u6210\uFF09\uFF08\u62D6\u5230\u5176\u4ED6\u65E5\u671F\u53EF\u6539\u671F\uFF0C\u70B9\u51FB\u52FE\u9009\u5B8C\u6210\uFF09",
      n_items: "{n} \u6761",
      add_todo: "\u52A0\u5F85\u529E",
      none_this_day: "\u8FD9\u5929\u6CA1\u6709\u5F85\u529E",
      add_todo_title: "\u6DFB\u52A0\u5F85\u529E",
      falls_on: "\u5C06\u843D\u5728 {due}",
      todo_ph_short: "\u5185\u5BB9\uFF0C\u53EF\u5E26 #\u6807\u7B7E",
      untagged: "\u672A\u5206\u7C7B",
      n_overdue: "\u903E\u671F {n}",
      all_done: "\u5168\u90E8\u5B8C\u6210",
      no_todos_yet: "\u8FD8\u6CA1\u6709\u5F85\u529E\uFF0C\u5148\u5728\u4E0A\u9762\u6DFB\u52A0\u4E00\u6761",
      prev: "\u4E0A\u4E00\u9875",
      next: "\u4E0B\u4E00\u9875",
      conflict_todo: "\u5F85\u529E\u5DF2\u88AB\u5916\u90E8\u4FEE\u6539\uFF08\u5982 Obsidian\uFF09\uFF0C\u5DF2\u52A0\u8F7D\u6700\u65B0\u5185\u5BB9\uFF0C\u8BF7\u91CD\u8BD5\u64CD\u4F5C",
      weekdays: "\u4E00,\u4E8C,\u4E09,\u56DB,\u4E94,\u516D,\u65E5",
      months: "\u4E00\u6708,\u4E8C\u6708,\u4E09\u6708,\u56DB\u6708,\u4E94\u6708,\u516D\u6708,\u4E03\u6708,\u516B\u6708,\u4E5D\u6708,\u5341\u6708,\u5341\u4E00\u6708,\u5341\u4E8C\u6708",
      add_link: "\u6DFB\u52A0\u94FE\u63A5",
      add_cat: "\u5206\u7C7B",
      del_cat: "\u5220\u9664\u5F53\u524D\u5206\u7C7B",
      check_links: "\u68C0\u67E5\u6B7B\u94FE",
      check_all: "\u68C0\u67E5\u5168\u90E8\u6B7B\u94FE",
      checking: "\u68C0\u6D4B\u4E2D\u2026",
      export_btn: "\u5BFC\u51FA",
      import_btn: "\u5BFC\u5165",
      export_t: "\u5BFC\u51FA\u4E3A\u4E66\u7B7E HTML\uFF08Edge / Chrome / Firefox \u4E66\u7B7E\u7BA1\u7406\u5668\u53EF\u76F4\u63A5\u5BFC\u5165\uFF09",
      import_t: "\u5BFC\u5165\u4E66\u7B7E HTML\uFF08\u6D4F\u89C8\u5668\u5BFC\u51FA\u7684\u4E66\u7B7E\u6587\u4EF6\uFF1B\u8FFD\u52A0\u5408\u5E76\u3001\u6309 URL \u53BB\u91CD\uFF0C\u4E0D\u8986\u76D6\u73B0\u6709\u6570\u636E\uFF09",
      no_cats: "\u8FD8\u6CA1\u6709\u5206\u7C7B\uFF0C\u70B9\u300C\u5206\u7C7B\u300D\u521B\u5EFA",
      no_links_cat: "\u8FD9\u4E2A\u5206\u7C7B\u8FD8\u6CA1\u6709\u94FE\u63A5",
      no_links_all: "\u8FD8\u6CA1\u6709\u4EFB\u4F55\u94FE\u63A5\uFF0C\u70B9\u300C\u6DFB\u52A0\u94FE\u63A5\u300D\u6216\u300C\u5BFC\u5165\u300D\u5F00\u59CB",
      all_tip: "\u67E5\u770B\u6240\u6709\u5206\u7C7B\u7684\u94FE\u63A5",
      dbl_del_cat: "\u53CC\u51FB\u5220\u9664\u5206\u7C7B",
      add_link_title: "\u6DFB\u52A0\u94FE\u63A5",
      name: "\u540D\u79F0",
      url_label: "\u7F51\u5740",
      category: "\u5206\u7C7B",
      save: "\u4FDD\u5B58",
      new_cat_title: "\u65B0\u5EFA\u5206\u7C7B",
      cat_ph: "\u5206\u7C7B\u540D\u79F0",
      del_cat_title: "\u5220\u9664\u5206\u7C7B",
      del_cat_msg: "\u5C06\u5220\u9664\u300C{name}\u300D\u53CA\u5176 {n} \u6761\u94FE\u63A5\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002",
      ok_del: "\u5220\u9664",
      imported: "\u5DF2\u5BFC\u5165",
      import_fail: "\u5BFC\u5165\u5931\u8D25\uFF1A",
      err_no_dl: "\u4E0D\u662F\u4E66\u7B7E HTML\uFF1A\u672A\u627E\u5230\u4E66\u7B7E\u5217\u8868",
      err_no_links: "\u672A\u5728\u6587\u4EF6\u4E2D\u627E\u5230\u4E66\u7B7E\u94FE\u63A5\uFF08\u8BF7\u786E\u8BA4\u662F\u6D4F\u89C8\u5668\u5BFC\u51FA\u7684\u4E66\u7B7E HTML\uFF09",
      check_result: "\u68C0\u6D4B {total} \u6761\uFF1A{ok} \u6B63\u5E38 \xB7 {bad} \u5F02\u5E38",
      exported: "\u5DF2\u5BFC\u51FA {cats} \u4E2A\u5206\u7C7B\u3001{links} \u6761\u94FE\u63A5\uFF08\u6D4F\u89C8\u5668\u4E66\u7B7E\u7BA1\u7406\u5668\u53EF\u76F4\u63A5\u5BFC\u5165\uFF09",
      conflict_nav: "\u5BFC\u822A.md \u5DF2\u88AB\u5916\u90E8\u4FEE\u6539\uFF08\u5982 Obsidian\uFF09\uFF0C\u5DF2\u52A0\u8F7D\u6700\u65B0\u5185\u5BB9\uFF0C\u8BF7\u91CD\u8BD5\u64CD\u4F5C",
      add_asset: "\u6DFB\u52A0\u8D44\u4EA7",
      ad_summary: "{c} \u6761\u51ED\u636E \xB7 {l} \u4E2A\u94FE\u63A5",
      ad_links: "\u76F8\u5173\u94FE\u63A5",
      ad_no_cred: "\u8FD8\u6CA1\u6709\u51ED\u636E\uFF0C\u70B9\u300C\u7F16\u8F91\u8D44\u4EA7\u300D\u6DFB\u52A0",
      enc_enable: "\u542F\u7528\u51ED\u636E\u52A0\u5BC6",
      enc_enable_tip: "\u51ED\u636E\u5F53\u524D\u4E3A\u660E\u6587\u3002\u542F\u7528\u540E\u51ED\u636E\u4EE5\u4E3B\u53E3\u4EE4\u6D3E\u751F\u5BC6\u94A5\u52A0\u5BC6\u843D\u76D8\uFF08\u7ED3\u6784\u53EF\u8BFB\uFF0C\u673A\u5BC6\u53EF\u62A4\uFF09",
      enc_unlock: "\u51ED\u636E\u5DF2\u52A0\u5BC6\uFF08\u70B9\u89E3\u9501\uFF09",
      enc_lock: "\u51ED\u636E\u5DF2\u89E3\u9501\uFF08\u70B9\u9501\u5B9A\uFF09",
      enc_lock_tip: "\u70B9\u51FB\u9501\u5B9A\u51ED\u636E\u5E93",
      enc_unlock_tip: "\u51ED\u636E\u5DF2\u52A0\u5BC6\uFF0C\u70B9\u51FB\u89E3\u9501",
      enc_disable: "\u5173\u95ED\u52A0\u5BC6",
      enc_disable_tip: "\u5173\u95ED\u52A0\u5BC6\uFF1A\u5168\u90E8\u51ED\u636E\u89E3\u5BC6\u4E3A\u660E\u6587",
      all_n: "\u5168\u90E8 {n}",
      online: "\u5728\u7EBF",
      offline: "\u79BB\u7EBF",
      unknown: "\u672A\u68C0",
      probe: "\u63A2\u6D4B",
      link_add: "\u94FE\u63A5",
      reveal: "\u67E5\u770B",
      hide: "\u9690\u85CF",
      copy: "\u590D\u5236",
      probe_toast: "\u63A2\u6D4B\u4E2D\u2026",
      probe_up: "\u5728\u7EBF \xB7 TCP \u53EF\u8FBE",
      probe_down: "\u79BB\u7EBF \xB7 \u8FDE\u63A5\u5931\u8D25",
      copied: "\u5DF2\u590D\u5236",
      copy_fail: "\u590D\u5236\u5931\u8D25",
      name_required: "\u540D\u79F0\u5FC5\u586B",
      added: "\u5DF2\u6DFB\u52A0",
      enc_enabled_toast: "\u5DF2\u542F\u7528\u51ED\u636E\u52A0\u5BC6\uFF08\u5F53\u524D\u4F1A\u8BDD\u5DF2\u89E3\u9501\uFF09",
      unlocked_toast: "\u5DF2\u89E3\u9501",
      locked_toast: "\u5DF2\u9501\u5B9A",
      enc_disabled_toast: "\u5DF2\u5173\u95ED\u52A0\u5BC6\uFF0C\u51ED\u636E\u4E3A\u660E\u6587",
      decrypt_fail: "\u89E3\u5BC6\u5931\u8D25\uFF1A",
      no_assets: "\u6CA1\u6709\u8D44\u4EA7\uFF0C\u70B9\u4E0B\u65B9 \uFF0B \u5F55\u5165\u7B2C\u4E00\u53F0\u670D\u52A1\u5668",
      expired: "\u5DF2\u8FC7\u671F",
      days: "\u5929",
      exp_tip: "\u70B9\u51FB\u4FEE\u6539\u5230\u671F\u65E5",
      edit: "\u7F16\u8F91",
      manage: "\u7BA1\u7406",
      edit_asset_title: "\u7F16\u8F91\u8D44\u4EA7",
      asset_updated: "\u8D44\u4EA7\u5DF2\u66F4\u65B0",
      cred_edit_title: "\u7F16\u8F91\u51ED\u636E",
      f_new_secret: "\u65B0\u673A\u5BC6",
      new_secret_ph: "\u7559\u7A7A\u4FDD\u6301\u4E0D\u53D8",
      cred_delete: "\u5220\u9664\u51ED\u636E",
      cred_delete_msg: "\u5220\u9664\u8FD9\u6761\u51ED\u636E\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002",
      cred_updated: "\u51ED\u636E\u5DF2\u66F4\u65B0",
      grp_rename_title: "\u91CD\u547D\u540D\u5206\u7EC4",
      grp_dbl_rename: "\u53CC\u51FB\u91CD\u547D\u540D\u5206\u7EC4",
      grp_renamed: "\u5206\u7EC4\u5DF2\u91CD\u547D\u540D",
      token_path_note: "\u4FDD\u5B58\u540E\u6B64\u5904\u663E\u793A\u4EE4\u724C\u6587\u4EF6\u8DEF\u5F84",
      cred_pw: "\u5BC6\u7801",
      cred_pk: "\u79C1\u94A5",
      cred_tok: "\u4EE4\u724C",
      f_token_file: "\u4EE4\u724C\u6587\u4EF6",
      token_pick: "\u9009\u62E9\u6587\u4EF6\u2026",
      token_hint: "\u5C06\u7EDF\u4E00\u4FDD\u5B58\u5230 data/tokens/<\u8D44\u4EA7\u540D>/ \u4E0B",
      token_pick_first: "\u4EE4\u724C\u7C7B\u578B\u9700\u8981\u5148\u9009\u62E9\u6587\u4EF6",
      token_too_big: "\u6587\u4EF6\u8D85\u8FC7 5 MB \u4E0A\u9650",
      token_saved_to: "\u4EE4\u724C\u6587\u4EF6\u5DF2\u4FDD\u5B58\u5230\uFF1A",
      token_hint_edit: "\u672A\u9009\u62E9\u65B0\u6587\u4EF6\u5219\u4FDD\u7559\u539F\u4EE4\u724C",
      multi_cred_hint: "\u6B64\u8D44\u4EA7\u6709 {n} \u6761\u51ED\u636E\uFF0C\u6B64\u5904\u7F16\u8F91\u7B2C\u4E00\u6761\uFF0C\u5176\u4F59\u7528\u5361\u7247\u4E0A\u7684\u9F7F\u8F6E\u6309\u94AE\u7BA1\u7406",
      cred_section_edit: "\u51ED\u636E",
      dlg_del_asset: "\u5220\u9664\u8D44\u4EA7",
      dlg_del_asset_msg: "\u5C06\u5220\u9664\u8D44\u4EA7\u300C{name}\u300D\u53CA\u5176\u5168\u90E8\u51ED\u636E\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002",
      add_asset_title: "\u6DFB\u52A0\u8D44\u4EA7",
      f_name: "\u540D\u79F0",
      f_host: "\u4E3B\u673A",
      f_port: "\u7AEF\u53E3",
      f_group: "\u5206\u7EC4",
      f_project: "\u9879\u76EE",
      f_notes: "\u5907\u6CE8",
      cred_optional: "\u51ED\u636E\uFF08\u53EF\u9009\uFF09",
      f_type: "\u7C7B\u578B",
      f_label: "\u6807\u7B7E",
      f_user: "\u7528\u6237\u540D",
      f_secret: "\u673A\u5BC6",
      f_pk: "\u79C1\u94A5\u5185\u5BB9",
      f_pp: "\u79C1\u94A5\u53E3\u4EE4",
      f_exp: "\u5230\u671F\u65E5",
      host_ph: "IP \u6216\u57DF\u540D",
      pp_ph: "\u65E0\u5219\u7559\u7A7A",
      add_rel_title: "\u8FFD\u52A0\u76F8\u5173\u94FE\u63A5",
      rel_name_ph: "\u7559\u7A7A\u5219\u663E\u793A\u7F51\u5740",
      vault_enable_t: "\u542F\u7528\u51ED\u636E\u52A0\u5BC6",
      vault_unlock_t: "\u89E3\u9501\u51ED\u636E\u5E93",
      vault_disable_t: "\u5173\u95ED\u51ED\u636E\u52A0\u5BC6",
      vault_enable_msg: "\u8BBE\u7F6E\u51ED\u636E\u5E93\u4E3B\u53E3\u4EE4\uFF08\u81F3\u5C11 4 \u4F4D\uFF09\u3002\u542F\u7528\u540E\u51ED\u636E\u5BC6\u6587\u843D\u76D8\uFF0C\u91CD\u542F\u540E\u9700\u89E3\u9501\u624D\u80FD\u67E5\u770B\u3002\n\u5FD8\u8BB0\u53E3\u4EE4 = \u65E0\u6CD5\u89E3\u5BC6\uFF0C\u9700\u91CD\u5F55\u51ED\u636E\uFF0C\u8BF7\u7262\u8BB0\uFF01",
      vault_unlock_msg: "\u8F93\u5165\u51ED\u636E\u5E93\u4E3B\u53E3\u4EE4\u89E3\u9501",
      vault_disable_msg: "\u8F93\u5165\u4E3B\u53E3\u4EE4\u4EE5\u5173\u95ED\u52A0\u5BC6\uFF08\u5168\u90E8\u51ED\u636E\u5C06\u89E3\u5BC6\u4E3A\u660E\u6587\uFF09",
      vault_ph: "\u4E3B\u53E3\u4EE4",
      exp_title: "\u5230\u671F\u65E5",
      exp_msg: "\u683C\u5F0F YYYY-MM-DD\uFF0C\u7559\u7A7A\u6E05\u9664",
      ungrouped: "\u672A\u5206\u7EC4",
      cancel: "\u53D6\u6D88",
      ok: "\u786E\u5B9A"
    },
    en: {
      app_name: "Personal Workbench",
      tab_apps: "Apps",
      tab_todo: "To-Do",
      tab_nav: "Nav",
      tab_assets: "Assets",
      appearance: "Appearance",
      auto: "Auto",
      light: "Light",
      dark: "Dark",
      theme_color: "Theme",
      blue: "Classic Blue",
      pink: "Sakura Pink",
      language: "Language",
      autostart: "Start at login",
      autostart_tip: "Start the background service silently at login (no page opened); current user only, stored in the HKCU Run key",
      conn_lost: "Service connection lost \u2014 reconnecting\u2026",
      conn_restored: "Service restored \u2014 refreshing",
      vault_remember: "Remember on this machine \u2014 auto-unlock after restart",
      tab_note: "Notes",
      tab_keys: "Key Docs",
      kd_new: "New doc",
      kd_name_ph: "Document name",
      kd_del: "Delete doc",
      kd_del_msg: 'Delete "{name}"? The file will be removed permanently.',
      kd_back: "Back to list",
      kd_conflict: "The document changed outside \u2014 latest content loaded, please retry",
      kd_saved: "Saved",
      kd_created: "Created",
      kd_deleted: "Deleted",
      kd_search: "Search docs\u2026",
      kd_chars: "{chars} chars",
      kd_empty_list: "No key documents yet",
      kd_empty_doc: 'Empty doc \u2014 click "Edit" to start',
      kd_add_title: "Add key document",
      kd_or: "or",
      kd_import_file: "Import .md / .txt file",
      kd_import_hint: "Pick a local Markdown or plain-text file; its content is saved as a key document as-is",
      kd_import_done: "Imported: {name}",
      kd_bad_file: "Only .md / .txt files are supported",
      kd_too_big: "File exceeds the 1 MB limit",
      note_earlier: "Earlier",
      tab_ai: "AI",
      ai_title: "AI Assistant",
      ai_ph: "Type a message \u2014 Enter to send, Shift+Enter for newline",
      ai_send: "Send",
      ai_config: "AI Settings",
      ai_provider: "Provider",
      ai_mode: "Access mode",
      ai_baseurl: "Base URL",
      ai_key: "API Key",
      ai_model: "Model",
      ai_test: "Test connection",
      ai_testing: "Testing\u2026",
      ai_test_ok: "\u2705 OK \xB7 {ms}ms",
      ai_test_fail: "\u274C Failed: ",
      ai_models: "Models (comma-separated, multiple allowed)",
      ai_model_ph: "Model ID, press Enter to add",
      add_model: "Add",
      ai_cfg_saved: "AI config saved",
      ai_key_keep: "Saved (leave empty to keep)",
      ai_need_cfg_first: "Configure the AI endpoint first (gear icon)",
      ai_new_session: "New session",
      ai_new_session_msg: "Clear this conversation and start a new one?",
      ai_welcome: "Workbench AI assistant: query to-dos, notes, server assets and nav links. Configure the endpoint via the gear icon first.",
      ai_ready_hint: "Ready",
      ai_asset_btn: "AI chat",
      ai_new_chat: "New chat",
      ai_no_sessions: "No sessions yet",
      ai_del_session: "Delete session",
      ai_sessions_view: "Sessions",
      ai_archived_view: "Archived",
      ai_archive: "Archive",
      ai_unarchive: "Restore",
      ai_persist_fail: "Failed to save session: ",
      ai_del_session_msg: 'Delete session "{name}"? The chat history will be removed too.',
      ai_sessions: "Sessions",
      ai_ctx_label: "Context",
      ai_ctx_clear: "Exit asset chat",
      confirm_approve: "Approve",
      confirm_reject: "Reject",
      confirm_title: "Needs your approval to run",
      ai_tool_read_todo: "Read to-dos",
      ai_tool_read_note: "Read notes",
      ai_tool_list_assets: "List assets",
      ai_tool_probe_asset: "Probe server",
      ai_tool_search_nav: "Search nav",
      ai_tool_list_keydocs: "List key docs",
      note_raw: "Edit raw",
      note_raw_save: "Save all",
      note_raw_cancel: "Discard",
      note_search: "Search notes\u2026",
      note_empty: "No notes yet \u2014 write your first one",
      note_none_match: "No matching notes",
      note_del: "Delete",
      note_edit: "Edit",
      note_save: "Save",
      note_cancel: "Cancel",
      note_stats: "{entries} entries \xB7 {chars} chars",
      note_conflict: "The notes file changed outside (e.g. Obsidian). Latest content loaded \u2014 please retry.",
      key_search: "Search name, URL, key\u2026",
      key_add: "Add entry",
      key_import: "Import text",
      key_import_title: "Import existing keys text",
      key_import_ph: "Paste your existing key document (# / ## headings become entry names)",
      key_import_apply: "Import",
      key_imported: "Imported {n} entries",
      key_export: "Export",
      key_empty: 'No entries yet \u2014 click "Add entry" or "Import text" to begin',
      key_none_match: "No matching entries",
      key_del_title: "Delete entry",
      key_del_msg: 'Delete "{name}"? This cannot be undone.',
      key_add_title: "Add entry",
      key_edit_title: "Edit entry",
      key_f_name: "Name",
      key_add_field: "Add field",
      key_raw: "Raw lines (optional, kept as-is)",
      key_conflict: "\u5BC6\u94A5.md changed outside (e.g. Obsidian). Latest content loaded \u2014 please retry.",
      key_all: "All",
      search_apps: "Search {n} apps\u2026",
      open_folder: "Open folder",
      refresh: "Refresh",
      set_folder: "Set folder",
      dir_line: "Folder {dir} \xB7 Click to launch, \u2606 pin / \u2605 unpin",
      dir_missing: 'App folder not found: {dir} \u2014 click "Set folder" to fix',
      dir_unset: 'No app folder configured \u2014 click "Set folder" to choose where shortcuts live',
      pinned: "Pinned",
      all_apps: "All apps",
      missing_tag: "Missing",
      pin_title: "Pin",
      unpin_title: "Unpin",
      card_title: "{file} \xB7 click to launch",
      missing_title: "{file} \xB7 file not found (moved or renamed?) \u2014 click the star to unpin",
      empty_apps: "No .lnk / .url shortcuts in the folder yet. Copy shortcuts from your Desktop or Start menu into the folder to launch them here.",
      no_match: 'No apps matching "{q}"',
      launched: "Launched: {name}",
      dir_updated: "App folder updated",
      set_dir_title: "App folder",
      set_dir_msg: "Folder holding .lnk / .url shortcuts (absolute path; leave empty to reset)",
      todo_ph: "New to-do \u2014 #tag and @2026-10-27 due date supported; Enter to add",
      cal_add_tip: "Add a to-do on this day",
      add: "Add",
      view_board: "Board",
      view_cal: "Calendar",
      view_track: "Track",
      stored_at: "Stored at {path} (Markdown list \u2014 Obsidian edits the same file)",
      overdue: "Overdue",
      inprog: "In progress",
      done: "Done",
      no_overdue: "Nothing overdue",
      no_inprog: "Nothing in progress",
      no_done: "No completed to-dos yet",
      scope_today: "Today",
      scope_week: "This week",
      scope_month: "This month",
      all: "All",
      seg_week: "Week",
      seg_month: "Month",
      show_done: "Show completed",
      none_in_range: "No to-dos in this range",
      legend_open: "Open",
      legend_drag: " \u2014 drag to another day to reschedule",
      legend_overdue: "Overdue",
      legend_done: "\u2713 Done",
      legend_done_note: " \u2014 stays on its due date",
      del: "Delete",
      click_select: "click to select",
      chip_title: "{text} \u2014 drag to another day to reschedule; click to check",
      chip_title_done: "{text} (done) \u2014 drag to another day to reschedule; click to uncheck",
      n_items: "{n} item(s)",
      add_todo: "Add to-do",
      none_this_day: "No to-dos on this day",
      add_todo_title: "Add to-do",
      falls_on: "Will be due on {due}",
      todo_ph_short: "Text, #tag supported",
      untagged: "Untagged",
      n_overdue: "{n} overdue",
      all_done: "All done",
      no_todos_yet: "No to-dos yet \u2014 add one above",
      prev: "Previous",
      next: "Next",
      conflict_todo: "The to-do list changed outside (e.g. Obsidian). Latest content loaded \u2014 please retry.",
      weekdays: "Mo,Tu,We,Th,Fr,Sa,Su",
      months: "January,February,March,April,May,June,July,August,September,October,November,December",
      add_link: "Add link",
      add_cat: "Category",
      del_cat: "Delete category",
      check_links: "Check dead links",
      check_all: "Check all links",
      checking: "Checking\u2026",
      export_btn: "Export",
      import_btn: "Import",
      export_t: "Export as bookmarks HTML (importable via Edge / Chrome / Firefox bookmark managers)",
      import_t: "Import bookmarks HTML (from a browser export; merged in, deduped by URL, never overwrites)",
      no_cats: 'No categories yet \u2014 click "Category" to create one',
      no_links_cat: "No links in this category",
      no_links_all: 'No links yet \u2014 click "Add link" or "Import" to begin',
      all_tip: "Show links from all categories",
      dbl_del_cat: "Double-click to delete",
      add_link_title: "Add link",
      name: "Name",
      url_label: "URL",
      category: "Category",
      save: "Save",
      new_cat_title: "New category",
      cat_ph: "Category name",
      del_cat_title: "Delete category",
      del_cat_msg: 'Delete "{name}" and its {n} link(s)? This cannot be undone.',
      ok_del: "Delete",
      imported: "Imported",
      import_fail: "Import failed: ",
      err_no_dl: "Not a bookmarks HTML: no bookmark list found",
      err_no_links: "No bookmark links found in the file (export bookmarks from your browser first)",
      check_result: "Checked {total} links: {ok} ok \xB7 {bad} failed",
      exported: "Exported {cats} categories, {links} links (importable in your browser's bookmark manager)",
      conflict_nav: "\u5BFC\u822A.md changed outside (e.g. Obsidian). Latest content loaded \u2014 please retry.",
      add_asset: "Add asset",
      ad_summary: "{c} credential(s) \xB7 {l} link(s)",
      ad_links: "Related links",
      ad_no_cred: 'No credentials yet \u2014 click "Edit asset" to add',
      enc_enable: "Enable encryption",
      enc_enable_tip: "Credentials are plain text now. Enable to encrypt them on disk with a master passphrase (structure stays readable)",
      enc_unlock: "Encrypted (click to unlock)",
      enc_lock: "Unlocked (click to lock)",
      enc_lock_tip: "Click to lock the vault",
      enc_unlock_tip: "Credentials encrypted \u2014 click to unlock",
      enc_disable: "Disable encryption",
      enc_disable_tip: "Turn off encryption: all credentials return to plain text",
      all_n: "All {n}",
      online: "Online",
      offline: "Offline",
      unknown: "Not checked",
      probe: "Probe",
      link_add: "Link",
      reveal: "Reveal",
      hide: "Hide",
      copy: "Copy",
      probe_toast: "Probing\u2026",
      probe_up: "Online \xB7 TCP reachable",
      probe_down: "Offline \xB7 connection failed",
      copied: "Copied",
      copy_fail: "Copy failed",
      name_required: "Name is required",
      added: "Added",
      enc_enabled_toast: "Encryption enabled (unlocked for this session)",
      unlocked_toast: "Unlocked",
      locked_toast: "Locked",
      enc_disabled_toast: "Encryption off \u2014 credentials are plain text now",
      decrypt_fail: "Decryption failed: ",
      no_assets: "No assets yet \u2014 click the + below to add your first server",
      expired: "expired",
      days: "d",
      exp_tip: "Click to edit the expiry date",
      edit: "Edit",
      manage: "Manage",
      edit_asset_title: "Edit asset",
      asset_updated: "Asset updated",
      cred_edit_title: "Edit credential",
      f_new_secret: "New secret",
      new_secret_ph: "Leave empty to keep current",
      cred_delete: "Delete credential",
      cred_delete_msg: "Delete this credential? This cannot be undone.",
      cred_updated: "Credential updated",
      grp_rename_title: "Rename group",
      grp_dbl_rename: "Double-click to rename group",
      grp_renamed: "Group renamed",
      token_path_note: "The token file path is shown here after saving",
      cred_pw: "Password",
      cred_pk: "Private key",
      cred_tok: "Token",
      f_token_file: "Token file",
      token_pick: "Choose file\u2026",
      token_hint: "Saved uniformly under data/tokens/<asset>/",
      token_pick_first: "Choose a token file first",
      token_too_big: "File exceeds the 5 MB limit",
      token_saved_to: "Token file saved to:",
      token_hint_edit: "No new file chosen \u2014 keep the current token",
      multi_cred_hint: "This asset has {n} credentials \u2014 editing the first one; manage the rest via the gear icon on the card",
      cred_section_edit: "Credentials",
      dlg_del_asset: "Delete asset",
      dlg_del_asset_msg: 'Delete asset "{name}" and all its credentials? This cannot be undone.',
      add_asset_title: "Add asset",
      f_name: "Name",
      f_host: "Host",
      f_port: "Port",
      f_group: "Group",
      f_project: "Project",
      f_notes: "Notes",
      cred_optional: "Credentials (optional)",
      f_type: "Type",
      f_label: "Label",
      f_user: "Username",
      f_secret: "Secret",
      f_pk: "Private key content",
      f_pp: "Passphrase",
      f_exp: "Expires",
      host_ph: "IP or domain",
      pp_ph: "Leave empty if none",
      add_rel_title: "Add related link",
      rel_name_ph: "Leave empty to show the URL",
      vault_enable_t: "Enable credential encryption",
      vault_unlock_t: "Unlock vault",
      vault_disable_t: "Disable encryption",
      vault_enable_msg: "Set a master passphrase (4+ chars). Secrets are stored encrypted; unlocking is required after a restart.\nForgot the passphrase = cannot decrypt; credentials must be re-entered. Keep it safe!",
      vault_unlock_msg: "Enter the vault master passphrase to unlock",
      vault_disable_msg: "Enter the master passphrase to disable encryption (all credentials return to plain text)",
      vault_ph: "Master passphrase",
      exp_title: "Expiry date",
      exp_msg: "Format YYYY-MM-DD; leave empty to clear",
      ungrouped: "Ungrouped",
      cancel: "Cancel",
      ok: "OK"
    }
  };
  var makeT = (lang) => (key, vars) => {
    let s = (I18N[lang] && I18N[lang][key]) ?? I18N.zh[key] ?? key;
    if (vars) for (const k in vars) s = s.split("{" + k + "}").join(String(vars[k]));
    return s;
  };
  function useTheme() {
    const [mode, setMode] = (0, import_react.useState)(() => localStorage.getItem("pwb_theme") || "auto");
    const [dark, setDark] = (0, import_react.useState)(false);
    (0, import_react.useEffect)(() => {
      const compute = () => {
        if (mode === "dark") return setDark(true);
        if (mode === "light") return setDark(false);
        let cs = "light";
        try {
          cs = getComputedStyle(document.documentElement).colorScheme;
        } catch {
        }
        const mq2 = matchMedia("(prefers-color-scheme: dark)");
        setDark(cs === "dark" || cs !== "light" && mq2.matches);
      };
      compute();
      const mq = matchMedia("(prefers-color-scheme: dark)");
      const mo = new MutationObserver(compute);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-ds-theme-source", "data-theme"] });
      mq.addEventListener("change", compute);
      return () => {
        mo.disconnect();
        mq.removeEventListener("change", compute);
      };
    }, [mode]);
    const set = (0, import_react.useCallback)((m) => {
      setMode(m);
      try {
        localStorage.setItem("pwb_theme", m);
      } catch {
      }
    }, []);
    return { mode, dark, set };
  }
  var CSS2 = `
.pwb {
  --pwb-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
  --pwb-radius-sm: 8px; --pwb-radius-md: 12px; --pwb-radius-lg: 16px;
  /* \u7ECF\u5178\u84DD \xB7 \u6D45\u8272 */
  --pwb-bg: #f5f5f7; --pwb-panel: #eceef2; --pwb-card: #ffffff;
  --pwb-border: #e4e5e9; --pwb-border-strong: #d3d4d9;
  --pwb-input-bg: #ffffff; --pwb-text: #1d1d1f; --pwb-muted: #6e6e73; --pwb-faint: #a5a5aa;
  --pwb-chip: #e9e9ee; --pwb-hover: #e7e8ee;
  --pwb-accent: #0066cc; --pwb-accent-hover: #0a70d8; --pwb-on-accent: #ffffff;
  --pwb-ring: rgba(0,102,204,.22);
  --pwb-tag-bg: #e2eefc; --pwb-tag-fg: #0a56b0;
  --pwb-ok-fg: #1c6b3c; --pwb-ok-bg: #dcf3e6;
  --pwb-bad-fg: #c0362c; --pwb-bad-bg: #fbe5e3;
  --pwb-danger: #d70015; --pwb-warn: #9a6a00;
  --pwb-topbar: rgba(245,245,247,.82);
  --pwb-overlay: rgba(15,17,20,.38);
  --pwb-seg-active: #ffffff;
  --pwb-switch-off: #d6d6db;
  --pwb-scrollbar: rgba(0,0,0,.24);
  --pwb-shadow-sm: 0 1px 2px rgba(0,0,0,.06);
  --pwb-shadow-md: 0 10px 28px rgba(0,0,0,.14);
  --pwb-shadow-pop: 0 16px 48px rgba(0,0,0,.2), 0 3px 10px rgba(0,0,0,.08);
  font: 13px/1.55 var(--pwb-font);
  color: var(--pwb-text);
  background: var(--pwb-bg);
  color-scheme: light;
  height: 100%;
  overflow: auto;
  -webkit-font-smoothing: antialiased;
}
/* \u7ECF\u5178\u84DD \xB7 \u6DF1\u8272 */
.pwb.pwb-dark {
  --pwb-bg: #111113; --pwb-panel: #19191c; --pwb-card: #1f1f22;
  --pwb-border: #2c2c30; --pwb-border-strong: #3c3c41;
  --pwb-input-bg: #27272b; --pwb-text: #f5f5f7; --pwb-muted: #a1a1a6; --pwb-faint: #78787e;
  --pwb-chip: #28282c; --pwb-hover: #303036;
  --pwb-accent: #409cff; --pwb-accent-hover: #63aeff; --pwb-on-accent: #ffffff;
  --pwb-ring: rgba(64,156,255,.3);
  --pwb-tag-bg: #20344a; --pwb-tag-fg: #7db8ff;
  --pwb-ok-fg: #6fdd8b; --pwb-ok-bg: #17301f;
  --pwb-bad-fg: #ff8a80; --pwb-bad-bg: #3a1b1c;
  --pwb-danger: #ff453a; --pwb-warn: #ffb86b;
  --pwb-topbar: rgba(17,17,19,.75);
  --pwb-overlay: rgba(0,0,0,.52);
  --pwb-seg-active: #5a5a61;
  --pwb-switch-off: #48484e;
  --pwb-scrollbar: rgba(255,255,255,.22);
  --pwb-shadow-sm: 0 1px 2px rgba(0,0,0,.4);
  --pwb-shadow-md: 0 10px 28px rgba(0,0,0,.5);
  --pwb-shadow-pop: 0 16px 48px rgba(0,0,0,.6), 0 3px 10px rgba(0,0,0,.4);
  color-scheme: dark;
}
/* \u6A31\u82B1\u7C89 \xB7 \u6D45\u8272 */
.pwb.pwb-pink {
  --pwb-bg: #faf5f7; --pwb-panel: #f4e9ee; --pwb-card: #ffffff;
  --pwb-border: #f0dce5; --pwb-border-strong: #e3c6d3;
  --pwb-input-bg: #ffffff; --pwb-text: #3b2531; --pwb-muted: #8a6b78; --pwb-faint: #bb9faa;
  --pwb-chip: #f5eaef; --pwb-hover: #f4e6ec;
  --pwb-accent: #cc3572; --pwb-accent-hover: #dd4a85; --pwb-on-accent: #ffffff;
  --pwb-ring: rgba(204,53,114,.22);
  --pwb-tag-bg: #fbe2ec; --pwb-tag-fg: #ab2157;
  --pwb-ok-fg: #1c6b3c; --pwb-ok-bg: #ddf3e6;
  --pwb-bad-fg: #c0362c; --pwb-bad-bg: #fbe5e3;
  --pwb-danger: #d70015; --pwb-warn: #9a6a00;
  --pwb-topbar: rgba(250,245,247,.85);
  --pwb-overlay: rgba(59,37,49,.35);
  --pwb-seg-active: #ffffff;
  --pwb-switch-off: #e6ccd8;
  --pwb-scrollbar: rgba(120,50,80,.25);
  --pwb-shadow-sm: 0 1px 2px rgba(120,50,80,.08);
  --pwb-shadow-md: 0 10px 28px rgba(150,60,95,.18);
  --pwb-shadow-pop: 0 16px 48px rgba(150,60,95,.24), 0 3px 10px rgba(150,60,95,.1);
}
/* \u6A31\u82B1\u7C89 \xB7 \u6DF1\u8272 */
.pwb.pwb-dark.pwb-pink {
  --pwb-bg: #161013; --pwb-panel: #1f1519; --pwb-card: #261a20;
  --pwb-border: #3a2932; --pwb-border-strong: #4c3742;
  --pwb-input-bg: #2d1f26; --pwb-text: #f6ebf0; --pwb-muted: #b59cab; --pwb-faint: #8a6e7c;
  --pwb-chip: #2f222a; --pwb-hover: #372730;
  --pwb-accent: #ff5c97; --pwb-accent-hover: #ff79ab; --pwb-on-accent: #ffffff;
  --pwb-ring: rgba(255,92,151,.3);
  --pwb-tag-bg: #432230; --pwb-tag-fg: #ff9cc0;
  --pwb-ok-fg: #6fdd8b; --pwb-ok-bg: #17301f;
  --pwb-bad-fg: #ff8a80; --pwb-bad-bg: #3a1b1c;
  --pwb-danger: #ff453a; --pwb-warn: #ffb86b;
  --pwb-topbar: rgba(22,16,19,.78);
  --pwb-overlay: rgba(0,0,0,.52);
  --pwb-seg-active: #55404b;
  --pwb-switch-off: #4c3742;
  --pwb-scrollbar: rgba(255,255,255,.22);
}
.pwb * { box-sizing: border-box; }
.pwb ::selection { background: var(--pwb-ring); }
.pwb ::-webkit-scrollbar { width: 11px; height: 11px; }
.pwb ::-webkit-scrollbar-thumb { background: var(--pwb-scrollbar); border-radius: 999px; border: 3px solid transparent; background-clip: content-box; }
.pwb ::-webkit-scrollbar-track { background: transparent; }

/* ---------- \u9876\u680F\uFF08\u6BDB\u73BB\u7483\uFF09\u4E0E\u54C1\u724C ---------- */
.pwb-topbar { display: flex; gap: 12px; align-items: center; padding: 9px 16px; position: sticky; top: 0; z-index: 20;
  background: var(--pwb-topbar); backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8);
  border-bottom: 1px solid var(--pwb-border); }
.pwb-brand { display: flex; align-items: center; gap: 8px; font-size: 13px; letter-spacing: -.01em; white-space: nowrap; }
.pwb-brand b { font-weight: 600; }
@media (max-width: 620px) { .pwb-brand b { display: none; } }

/* ---------- \u5206\u6BB5\u63A7\u4EF6 ---------- */
.pwb-seg { display: inline-flex; gap: 2px; background: var(--pwb-chip); border-radius: 9px; padding: 2px; flex-shrink: 0; }
.pwb .pwb-seg-item { display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--pwb-muted);
  height: 26px; padding: 0 12px; border-radius: 7px; font-size: 12.5px; font-weight: 500; cursor: pointer;
  transition: color .15s, background .15s, box-shadow .15s; }
.pwb .pwb-seg-item:hover { color: var(--pwb-text); background: transparent; }
.pwb .pwb-seg-item.on { background: var(--pwb-seg-active); color: var(--pwb-text); box-shadow: 0 1px 3px rgba(0,0,0,.14), 0 0 0 .5px rgba(0,0,0,.04); }
.pwb .pwb-seg.mini .pwb-seg-item { height: 22px; padding: 0 9px; font-size: 12px; }

/* ---------- \u5F39\u51FA\u8BBE\u7F6E ---------- */
.pwb-pop-overlay { position: fixed; inset: 0; z-index: 44; }
.pwb-pop { position: fixed; top: 50px; right: 14px; z-index: 45; width: 224px; background: var(--pwb-topbar);
  backdrop-filter: blur(24px) saturate(1.8); -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid var(--pwb-border); border-radius: 14px; padding: 12px; box-shadow: var(--pwb-shadow-pop);
  animation: pwbPop .18s cubic-bezier(.32,.72,.35,1); }
.pwb-pop-title { font-size: 11.5px; font-weight: 600; color: var(--pwb-faint); margin: 2px 2px 6px; }
.pwb-pop-row + .pwb-pop-row { margin-top: 12px; }
.pwb-swatches { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pwb .pwb-swatch { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 6px 8px; border-radius: 10px;
  background: var(--pwb-chip); border: 1px solid transparent; cursor: pointer; font-size: 12px; color: var(--pwb-muted); font-weight: 500; height: auto; }
.pwb .pwb-swatch i { width: 26px; height: 26px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); }
.pwb .pwb-swatch.on { border-color: var(--pwb-accent); color: var(--pwb-text); background: var(--pwb-tag-bg); }
.pwb .pwb-swatch .pwb-ic { color: var(--pwb-accent); }

/* ---------- \u63A7\u4EF6 ---------- */
.pwb button { appearance: none; display: inline-flex; align-items: center; justify-content: center; gap: 5px; flex-shrink: 0;
  font: inherit; font-weight: 500; color: var(--pwb-text); background: var(--pwb-chip); border: none; border-radius: 8px;
  padding: 0 12px; height: 30px; cursor: pointer; transition: background .15s, transform .1s, box-shadow .15s, color .15s; }
.pwb button:hover { background: var(--pwb-hover); }
.pwb button:active { transform: scale(.97); }
.pwb button:disabled { opacity: .45; cursor: default; transform: none; }
.pwb button.primary { background: var(--pwb-accent); color: var(--pwb-on-accent); }
.pwb button.primary:hover { background: var(--pwb-accent-hover); }
.pwb button.danger { background: var(--pwb-danger); color: #fff; }
.pwb button.ghost { background: transparent; color: var(--pwb-muted); }
.pwb button.ghost:hover { background: var(--pwb-hover); color: var(--pwb-text); }
.pwb button.mini { height: 24px; padding: 0 9px; font-size: 12px; border-radius: 7px; }
.pwb .ibtn { width: 28px; height: 28px; padding: 0; border-radius: 8px; background: transparent; color: var(--pwb-muted); }
.pwb .ibtn:hover { background: var(--pwb-hover); color: var(--pwb-text); }
.pwb .ibtn.on { background: var(--pwb-hover); color: var(--pwb-text); }
.pwb .ibtn.sm { width: 22px; height: 22px; border-radius: 6px; }
.pwb .ibtn.red { color: var(--pwb-bad-fg); }
.pwb .ibtn.red:hover { background: var(--pwb-bad-bg); color: var(--pwb-bad-fg); }
.pwb input, .pwb select, .pwb textarea { font: inherit; color: var(--pwb-text); background: var(--pwb-input-bg);
  border: 1px solid var(--pwb-border-strong); border-radius: 8px; padding: 5px 10px; min-height: 30px; outline: none;
  transition: border-color .15s, box-shadow .15s; }
.pwb textarea { height: auto; padding: 8px 10px; line-height: 1.5; }
.pwb input:focus, .pwb select:focus, .pwb textarea:focus { border-color: var(--pwb-accent); box-shadow: 0 0 0 3px var(--pwb-ring); }
.pwb input::placeholder, .pwb textarea::placeholder { color: var(--pwb-faint); }
.pwb input[type="checkbox"] { min-height: 0; width: 15px; height: 15px; padding: 0; margin: 0; accent-color: var(--pwb-accent); cursor: pointer; }
.pwb input[type="date"] { font-variant-numeric: tabular-nums; }
.pwb-search { position: relative; flex: 1; min-width: 180px; display: flex; }
.pwb-search > .pwb-ic { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--pwb-faint); pointer-events: none; }
.pwb-search input { width: 100%; padding-left: 29px; padding-right: 28px; }
.pwb-search-clear { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); }
.pwb .pwb-switch { position: relative; width: 34px; height: 20px; border-radius: 999px; background: var(--pwb-switch-off);
  border: none; padding: 0; cursor: pointer; flex-shrink: 0; transition: background .2s; }
.pwb .pwb-switch:hover { background: var(--pwb-switch-off); }
.pwb .pwb-switch.on, .pwb .pwb-switch.on:hover { background: var(--pwb-accent); }
.pwb .pwb-switch .pwb-switch-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: transform .2s cubic-bezier(.3,.7,.4,1.15); }
.pwb .pwb-switch.on .pwb-switch-knob { transform: translateX(14px); }

/* ---------- \u5E03\u5C40\u57FA\u4EF6 ---------- */
.pwb-body { padding: 4px 16px 18px; animation: pwbBodyIn .22s ease; }
.pwb .row { display: flex; gap: 8px; align-items: center; min-width: 0; }
.pwb .muted { color: var(--pwb-muted); font-size: 12px; }
.pwb .spacer { flex: 1; }
.pwb .card { background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: var(--pwb-radius-lg); padding: 13px 14px; }
.pwb h3 { margin: 2px 0 10px; font-size: 14.5px; font-weight: 600; letter-spacing: -.01em; }
.pwb .pwb-ic { flex-shrink: 0; }
.pwb .empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 26px 10px; color: var(--pwb-muted); font-size: 12.5px; text-align: center; }
.pwb .empty .pwb-ic { color: var(--pwb-faint); }

/* ---------- \u5F85\u529E ---------- */
.pwb .kanban { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 12px; align-items: start; }
.pwb .kcol { background: var(--pwb-panel); border-radius: var(--pwb-radius-lg); padding: 12px; min-width: 0; }
.pwb .kcol h4 { display: flex; align-items: center; gap: 6px; margin: 2px 2px 10px; font-size: 12.5px; font-weight: 600; }
.pwb .kcol h4 .count { font-weight: 600; opacity: .75; font-variant-numeric: tabular-nums; }
.pwb .kcol h4.c-overdue { color: var(--pwb-bad-fg); }
.pwb .kcol h4.c-active { color: var(--pwb-accent); }
.pwb .kcol h4.c-done { color: var(--pwb-ok-fg); }
.pwb .kitem { display: flex; gap: 9px; align-items: flex-start; background: var(--pwb-card); border: 1px solid var(--pwb-border);
  border-radius: 10px; padding: 9px 11px; margin-bottom: 7px; transition: box-shadow .18s; }
.pwb .kitem:hover { box-shadow: var(--pwb-shadow-sm); }
.pwb .kitem input[type="checkbox"] { margin-top: 2px; }
.pwb .kitem .txt { flex: 1; word-break: break-all; min-width: 0; }
.pwb .kitem.done .txt { color: var(--pwb-muted); text-decoration: line-through; }
.pwb .tag { display: inline-flex; background: var(--pwb-tag-bg); color: var(--pwb-tag-fg); border-radius: 5px; padding: 0 6px;
  margin-left: 5px; font-size: 11px; font-weight: 500; line-height: 17px; white-space: nowrap; }
.pwb .due { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: var(--pwb-muted); margin-left: 7px;
  font-variant-numeric: tabular-nums; white-space: nowrap; }
.pwb .due.overdue { color: var(--pwb-bad-fg); font-weight: 500; }
.pwb .due.today { color: var(--pwb-warn); font-weight: 500; }
.pwb .bar { height: 6px; background: var(--pwb-chip); border-radius: 999px; overflow: hidden; margin-top: 8px; }
.pwb .bar i { display: block; height: 100%; background: var(--pwb-accent); border-radius: 999px; transition: width .3s ease; }
.pwb .track-item { display: flex; align-items: center; gap: 7px; padding: 3px 0; font-size: 12.5px; min-width: 0; }
.pwb .track-item .t { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pwb .tdot { width: 5px; height: 5px; border-radius: 50%; background: var(--pwb-faint); flex-shrink: 0; }

/* ---------- \u65E5\u5386 ---------- */
.pwb .calwrap { display: grid; grid-template-columns: 290px 1fr; gap: 12px; margin-top: 12px; align-items: start; }
@media (max-width: 900px) { .pwb .calwrap { grid-template-columns: 1fr; } }
.pwb .calhead { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.pwb .calhead b { font-size: 14px; font-weight: 600; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
.pwb .calnav { border: none; background: transparent; color: var(--pwb-muted); padding: 0; width: 26px; height: 26px;
  border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.pwb .calnav:hover { background: var(--pwb-hover); color: var(--pwb-text); }
.pwb .calgrid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.pwb .calwd { text-align: center; color: var(--pwb-faint); font-size: 11.5px; padding: 2px 0 6px; }
.pwb .calcell { position: relative; min-height: 80px; background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: 10px;
  padding: 5px 6px; cursor: pointer; display: flex; flex-direction: column; gap: 3px; overflow: hidden;
  transition: border-color .15s, box-shadow .15s; }
.pwb .calcell:hover { border-color: var(--pwb-border-strong); }
.pwb .calcell .cal-add { position: absolute; top: 4px; right: 4px; width: 17px; height: 17px; padding: 0; border-radius: 5px;
  border: none; background: var(--pwb-chip); color: var(--pwb-muted); display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; opacity: .4; transition: opacity .15s, background .15s, color .15s; }
.pwb .calcell:hover .cal-add, .pwb .calcell .cal-add:focus { opacity: 1; }
.pwb .calcell .cal-add:hover { background: var(--pwb-accent); color: var(--pwb-on-accent); }
.pwb .calcell.dragover { border-color: var(--pwb-accent); box-shadow: 0 0 0 2px var(--pwb-ring); }
.pwb .calcell.dim { opacity: .45; }
.pwb .calcell.sel { border-color: var(--pwb-accent); box-shadow: 0 0 0 2px var(--pwb-ring); }
.pwb .calnum { font-size: 12px; color: var(--pwb-muted); width: 20px; height: 20px; display: inline-flex; align-items: center;
  justify-content: center; font-variant-numeric: tabular-nums; border-radius: 999px; }
.pwb .calcell.today .calnum { background: var(--pwb-accent); color: var(--pwb-on-accent); font-weight: 600; }
.pwb .calchip { font-size: 11px; font-weight: 500; border-radius: 6px; padding: 1px 6px; background: var(--pwb-tag-bg);
  color: var(--pwb-tag-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: grab; }
.pwb .calchip.done { opacity: .5; text-decoration: line-through; cursor: default; }
.pwb .calchip.overdue { background: var(--pwb-bad-bg); color: var(--pwb-bad-fg); }
.pwb .callegend { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 0 0 8px; color: var(--pwb-muted); font-size: 12px; }
.pwb .caldetail { margin-top: 10px; border-top: 1px solid var(--pwb-border); padding-top: 9px; }

/* ---------- \u82AF\u7247 / \u5FBD\u7AE0 ---------- */
.pwb .chip, .pwb .nav-chip { display: inline-flex; align-items: center; gap: 4px; padding: 0 11px; height: 26px; border-radius: 999px;
  background: var(--pwb-chip); border: 1px solid transparent; cursor: pointer; font-size: 12px; font-weight: 500;
  color: var(--pwb-muted); transition: background .15s, color .15s; white-space: nowrap; flex-shrink: 0; }
.pwb .chip:hover, .pwb .nav-chip:hover { color: var(--pwb-text); background: var(--pwb-hover); }
.pwb .chip.on, .pwb .nav-chip.on { background: var(--pwb-tag-bg); color: var(--pwb-accent); }
.pwb .nav-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.pwb .badge { display: inline-flex; align-items: center; font-size: 11px; font-weight: 500; border-radius: 999px; padding: 1px 8px;
  margin-left: 6px; background: var(--pwb-chip); color: var(--pwb-muted); white-space: nowrap; flex-shrink: 0;
  font-variant-numeric: tabular-nums; }
.pwb .badge.up { background: var(--pwb-ok-bg); color: var(--pwb-ok-fg); }
.pwb .badge.down { background: var(--pwb-bad-bg); color: var(--pwb-bad-fg); }
.pwb .badge.exp { cursor: pointer; }

/* ---------- \u5BFC\u822A / \u5E94\u7528\u5361\u7247 ---------- */
.pwb .linkgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 8px; }
.pwb .linkcard { display: flex; align-items: center; gap: 8px; background: var(--pwb-card); border: 1px solid var(--pwb-border);
  border-radius: var(--pwb-radius-md); padding: 8px 10px; cursor: pointer; min-width: 0;
  transition: box-shadow .18s, transform .18s, border-color .18s; }
.pwb .linkcard:hover { border-color: var(--pwb-border-strong); box-shadow: var(--pwb-shadow-sm); transform: translateY(-1px); }
.pwb .linkcard:active { transform: translateY(0) scale(.985); }
.pwb .linkcard .ico { width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0; background: var(--pwb-chip); }
.pwb .linkcard .t { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; font-weight: 500; }
.pwb .linkcard .badge { flex-shrink: 0; margin-left: 4px; }
.pwb .linkcard .x { visibility: hidden; }
.pwb .linkcard:hover .x { visibility: visible; }
.pwb .linkcard.dead { border-color: var(--pwb-bad-fg); }
.pwb .appsec { margin: 16px 2px 8px; font-size: 12.5px; font-weight: 600; display: flex; align-items: center; gap: 5px; }
.pwb .appsec:first-child { margin-top: 4px; }
.pwb .appsec .muted { font-weight: 400; font-variant-numeric: tabular-nums; }
.pwb .appsec .pwb-ic { color: var(--pwb-accent); }
.pwb .appsec + .assetgrid, .pwb .appsec + .linkgrid, .pwb .appsec + .appgrid { margin-top: 2px; }
.pwb .appgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 8px; }
.pwb .appcard { display: flex; align-items: center; gap: 10px; background: var(--pwb-card); border: 1px solid var(--pwb-border);
  border-radius: var(--pwb-radius-md); padding: 9px 10px; cursor: pointer; min-width: 0; user-select: none;
  transition: box-shadow .18s, transform .18s, border-color .18s; }
.pwb .appcard:hover { border-color: var(--pwb-border-strong); box-shadow: var(--pwb-shadow-sm); transform: translateY(-1px); }
.pwb .appcard:active { transform: translateY(0) scale(.985); }
.pwb .appcard .ico { width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0; background: var(--pwb-chip); object-fit: contain; }
.pwb .appcard .t { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; font-weight: 500; }
.pwb .appcard .pin { visibility: hidden; border: none; background: transparent; padding: 2px; color: var(--pwb-faint);
  border-radius: 6px; display: inline-flex; cursor: pointer; }
.pwb .appcard .pin:hover { color: var(--pwb-accent); background: var(--pwb-hover); }
.pwb .appcard:hover .pin, .pwb .appcard.pinned .pin { visibility: visible; }
.pwb .appcard.pinned .pin { color: var(--pwb-accent); }
.pwb .appcard.missing { opacity: .6; }
.pwb .appcard.missing .t { text-decoration: line-through; }
.pwb .appcard.busy { opacity: .55; pointer-events: none; }

/* ---------- \u8D44\u4EA7 ---------- */
.pwb .assetgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(258px, 1fr)); gap: 10px; margin-top: 12px; }
/* \u8D44\u4EA7\u5361\u56FA\u5B9A\u5C3A\u5BF8\uFF1A\u957F\u540D\u79F0\u7701\u7565\u53F7\u622A\u65AD\uFF0C\u8BE6\u60C5\uFF08\u51ED\u636E/\u94FE\u63A5/\u5907\u6CE8\uFF09\u70B9\u51FB\u5361\u7247\u5F39\u7A97\u67E5\u770B */
.pwb .acard { display: flex; flex-direction: column; background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: var(--pwb-radius-lg);
  padding: 12px 13px; position: relative; height: 96px; overflow: hidden; cursor: pointer; transition: box-shadow .18s, border-color .18s; }
.pwb .acard:hover { border-color: var(--pwb-border-strong); box-shadow: var(--pwb-shadow-sm); }
.pwb .appsec .ibtn { visibility: hidden; margin-left: auto; }
.pwb .appsec:hover .ibtn { visibility: visible; }
.pwb .acard .name { flex: 1; min-width: 0; font-weight: 600; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pwb .acard .card-actions { position: absolute; right: 7px; bottom: 7px; display: flex; gap: 2px; opacity: 0; transition: opacity .15s;
  background: var(--pwb-card); border-radius: 8px; padding: 2px; z-index: 2; }
.pwb .acard:hover .card-actions { opacity: 1; }
.pwb .a-line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--pwb-muted); font-variant-numeric: tabular-nums; }
.pwb .alink { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; font-size: 12px; font-weight: 500;
  height: 24px; padding: 0 10px; border-radius: 999px; cursor: pointer; background: var(--pwb-tag-bg); color: var(--pwb-accent);
  border: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-decoration: none;
  transition: box-shadow .15s; }
.pwb .alink:hover { box-shadow: var(--pwb-shadow-sm); }
.pwb .cred { margin-top: 9px; border-top: 1px solid var(--pwb-border); padding-top: 9px; font-size: 12px; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.pwb .cred .sec { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 11.5px; background: var(--pwb-chip);
  border-radius: 6px; padding: 2px 7px; word-break: break-all; color: var(--pwb-text); user-select: all; }
.pwb .field { display: grid; grid-template-columns: 64px 1fr; gap: 10px; align-items: center; margin-bottom: 10px; }
.pwb .field label { color: var(--pwb-muted); font-size: 12.5px; text-align: right; }
.pwb .field input, .pwb .field select, .pwb .field textarea { width: 100%; }

/* ---------- \u5F39\u5C42 / \u63D0\u793A ---------- */
.pwb-conn { position: fixed; top: 52px; left: 50%; transform: translateX(-50%); z-index: 30; display: flex; align-items: center; gap: 7px;
  background: var(--pwb-bad-bg); color: var(--pwb-bad-fg); border: 1px solid var(--pwb-bad-fg); border-radius: 999px;
  padding: 5px 14px; font-size: 12.5px; font-weight: 500; box-shadow: var(--pwb-shadow-md); animation: pwbFade .2s ease; }
.pwb-conn .pwb-ic { animation: pwbSpin 1.2s linear infinite; }
.pwb-modal-bg { position: fixed; inset: 0; background: var(--pwb-overlay); z-index: 50; display: flex; align-items: center;
  justify-content: center; backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: pwbFade .18s ease; }
.pwb-modal { width: min(440px, 92%); background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: 16px;
  padding: 16px 18px; box-shadow: var(--pwb-shadow-pop); animation: pwbPop .22s cubic-bezier(.32,.72,.35,1); max-height: 86vh; overflow: auto; }
.pwb-modal.wide { width: min(500px, 94%); }
.pwb-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.pwb-modal-head h3 { margin: 0; }
.pwb-dlg-msg { color: var(--pwb-muted); margin-bottom: 10px; white-space: pre-line; }
.pwb-toast { position: fixed; right: 20px; bottom: 20px; display: flex; align-items: center; gap: 8px;
  background: var(--pwb-topbar); backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8);
  border: 1px solid var(--pwb-border); color: var(--pwb-text); border-radius: 12px; padding: 10px 14px; z-index: 60;
  max-width: 380px; box-shadow: var(--pwb-shadow-md); font-weight: 500; animation: pwbToastIn .25s cubic-bezier(.3,.8,.35,1); }
.pwb-toast > .pwb-ic { color: var(--pwb-ok-fg); }
.pwb-toast.err { border-color: var(--pwb-bad-fg); }
.pwb-toast.err > .pwb-ic { color: var(--pwb-bad-fg); }

/* ---------- \u901F\u8BB0 / \u5BC6\u94A5 ---------- */
.pwb .note-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px; margin-top: 12px; align-items: start; }
.pwb .note-card { position: relative; height: 172px; display: flex; flex-direction: column; }
.pwb .note-card.editing { height: auto; min-height: 172px; }
.pwb .note-time { font-size: 11px; color: var(--pwb-faint); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.pwb .note-body { flex: 1; overflow: hidden; margin-top: 4px; }
.pwb .note-card:hover { box-shadow: var(--pwb-shadow-sm); }
.pwb .note-card .card-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 2px; opacity: 0; transition: opacity .15s;
  background: var(--pwb-card); border-radius: 8px; padding: 2px; z-index: 2; }
.pwb .note-card:hover .card-actions { opacity: 1; }
.pwb .note-card.editing .card-actions { position: static; opacity: 1; margin-top: 8px; justify-content: flex-end; }
.pwb .note-title { font-weight: 600; font-size: 12.5px; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
.pwb .note-body { white-space: pre-wrap; word-break: break-word; font-size: 12.5px; }
.pwb .keylist { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.pwb .kgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 10px; margin-top: 12px; align-items: start; }
.pwb .kcard { background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: var(--pwb-radius-lg); padding: 12px 13px; min-width: 0; }
.pwb .kname { font-weight: 600; letter-spacing: -.01em; font-size: 13px; }
.pwb .kfield { display: flex; align-items: center; gap: 6px; padding: 3px 0; min-width: 0; font-size: 12.5px; }
.pwb .kfield .k { color: var(--pwb-muted); flex-shrink: 0; min-width: 56px; }
.pwb .kfield .v { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 12px; }
.pwb .kfield .v.masked { letter-spacing: .06em; }
.pwb .kdoc-view { white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 12.5px; line-height: 1.6;
  background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: var(--pwb-radius-lg); padding: 14px; min-height: 320px; }
.pwb .kraw { white-space: pre-wrap; word-break: break-word; font-size: 12px; color: var(--pwb-muted); background: var(--pwb-panel); border-radius: 8px; padding: 6px 9px; margin-top: 6px; }
/* \u5BC6\u94A5\u6587\u6863\u5361\u56FA\u5B9A\u5C3A\u5BF8\uFF08\u4E0E\u901F\u8BB0\u5361\u540C\u9AD8\uFF09\uFF0C\u5185\u5BB9\u70B9\u5F00\u5F39\u7A97\u67E5\u770B */
.pwb .kdoc-card { position: relative; height: 172px; overflow: hidden; cursor: pointer; display: flex; flex-direction: column; }
.pwb .kdoc-card:hover { box-shadow: var(--pwb-shadow-sm); }
.pwb .kdoc-card .note-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pwb .kdoc-card .card-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 2px; opacity: 0; transition: opacity .15s;
  background: var(--pwb-card); border-radius: 8px; padding: 2px; z-index: 2; }
.pwb .kdoc-card:hover .card-actions { opacity: 1; }
.pwb .kdoc-preview { flex: 1; overflow: hidden; margin-top: 6px; color: var(--pwb-muted); font-size: 12.5px; line-height: 1.5;
  white-space: pre-wrap; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; }

/* ---------- \u8BE6\u60C5\u5F39\u7A97\uFF08\u8D44\u4EA7 / \u5BC6\u94A5\u6587\u6863\u5361\u7247\u70B9\u5F00\uFF09 ---------- */
.pwb .detail-kv { display: grid; grid-template-columns: auto 1fr; gap: 5px 14px; margin: 8px 0 2px; font-size: 12.5px; align-items: baseline; }
.pwb .detail-kv .k { color: var(--pwb-muted); white-space: nowrap; }
.pwb .detail-kv .v { min-width: 0; word-break: break-all; }
.pwb .detail-sec { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--pwb-border); }
.pwb .sec-title { display: flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; margin-bottom: 8px; }
.pwb .sec-title .pwb-ic { color: var(--pwb-accent); }
.pwb .cred-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 3px 0; min-width: 0; }

/* ---------- \u65B0\u589E\u5361\u7247\uFF08\u8D44\u4EA7/\u901F\u8BB0/\u5BC6\u94A5\u6587\u6863\u5217\u8868\u672B\u5C3E\u7684 \uFF0B \u865A\u7EBF\u5361\uFF09 ---------- */
.pwb .addcard { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;
  height: 108px; padding: 0; background: transparent; border: 1.5px dashed var(--pwb-border-strong);
  border-radius: var(--pwb-radius-lg); color: var(--pwb-faint); font-size: 12.5px; font-weight: 500; min-width: 0;
  cursor: pointer; transition: border-color .15s, color .15s, background .15s, transform .15s; }
.pwb .addcard:hover { border-color: var(--pwb-accent); color: var(--pwb-accent); background: var(--pwb-card); transform: translateY(-1px); }
.pwb .addcard:active { transform: none; }
.pwb .note-grid .addcard { height: 172px; }
/* \u6DFB\u52A0\u6587\u6863\u5F39\u7A97\uFF1A\u300C\u6216\u300D\u5206\u9694\u7EBF */
.pwb .kd-or { display: flex; align-items: center; gap: 10px; margin: 14px 0; color: var(--pwb-faint); font-size: 12px; }
.pwb .kd-or::before, .pwb .kd-or::after { content: ""; flex: 1; height: 1px; background: var(--pwb-border); }

/* ---------- AI \u53CC\u680F\u5E03\u5C40 ---------- */
.pwb.ai-page { display: flex; flex-direction: column; overflow: hidden; }
.pwb.ai-page .pwb-topbar { flex-shrink: 0; }
.pwb.ai-page .pwb-body { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; padding: 12px 16px 0; }
.pwb .ai-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: 250px 1fr; gap: 14px; }
.pwb .ai-side { background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: var(--pwb-radius-lg); padding: 10px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
.pwb .ai-sessions { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
.pwb .ai-new { width: 100%; }
.pwb .ai-main { min-width: 0; display: flex; flex-direction: column; background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: var(--pwb-radius-lg); overflow: hidden; }
.pwb .ai-msgs { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 16px 8px; }
.pwb .ai-msgs-inner, .pwb .ai-input-inner { max-width: 780px; margin: 0 auto; width: 100%; }
.pwb .ai-input { flex-shrink: 0; border-top: 1px solid var(--pwb-border); background: var(--pwb-card); padding: 10px 16px 12px; }
.pwb .ai-input-box { max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; gap: 6px; background: var(--pwb-panel); border: 1px solid var(--pwb-border); border-radius: 14px; padding: 10px 12px 8px; }
.pwb .ai-input-box:focus-within { border-color: var(--pwb-accent); }
.pwb .ai-input-box textarea { background: transparent; border: none; padding: 4px 6px; min-height: 72px; max-height: 180px; resize: none; }
.pwb .ai-input-actions { display: flex; justify-content: flex-end; align-items: center; gap: 6px; }
.pwb .ai-input-actions .ai-model-sel { max-width: 190px; font-size: 12px; background: transparent; border: none; padding: 0 2px; color: var(--pwb-muted); }
.pwb .ai-models-edit { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.pwb .ai-model-chip { display: inline-flex; align-items: center; gap: 4px; background: var(--pwb-chip); border-radius: 999px; padding: 2px 6px 2px 10px; font-size: 12px; }
.pwb .ai-model-add { flex: 1; min-width: 120px; font-size: 12px; }
.pwb .ai-send { padding: 0 14px; }
@media (max-width: 900px) { .pwb .ai-layout { grid-template-columns: 1fr; } .pwb .ai-side { max-height: 200px; } }
.pwb .ai-sessions { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; max-height: 60vh; }
.pwb .ai-session { border-radius: 10px; padding: 8px 10px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; border: 1px solid transparent; }
.pwb .ai-session:hover { background: var(--pwb-hover); }
.pwb .ai-session.on { background: var(--pwb-tag-bg); border-color: var(--pwb-border); }
.pwb .ai-session-title { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pwb .ai-session-meta { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--pwb-faint); }
.pwb .ai-main { min-width: 0; }
.pwb .ai-cur-title { font-weight: 600; font-size: 13.5px; }
@media (max-width: 900px) { .pwb .ai-layout { grid-template-columns: 1fr; } .pwb .ai-sessions { max-height: 180px; } }

/* ---------- AI \u786E\u8BA4\u5361 / \u8D44\u4EA7\u4E0A\u4E0B\u6587 ---------- */
.pwb .ai-confirm { background: var(--pwb-bad-bg); border: 1px solid var(--pwb-bad-fg); border-radius: 10px; padding: 8px 10px; margin: 6px 0 4px; }
.pwb .ai-confirm-title { display: flex; align-items: center; gap: 5px; font-weight: 600; font-size: 12px; color: var(--pwb-bad-fg); margin-bottom: 4px; }
.pwb .ai-confirm-body { font-size: 12.5px; word-break: break-all; }
.pwb .ai-ctx { display: flex; align-items: center; gap: 7px; background: var(--pwb-tag-bg); color: var(--pwb-tag-fg); border-radius: 999px; padding: 4px 6px 4px 10px; font-size: 12px; font-weight: 500; margin-bottom: 10px; width: fit-content; max-width: 100%; }

/* ---------- \u52A8\u6548 ---------- */
@keyframes pwbFade { from { opacity: 0; } }
@keyframes pwbSpin { to { transform: rotate(360deg); } }
@keyframes pwbPop { from { opacity: 0; transform: scale(.96) translateY(4px); } }
@keyframes pwbToastIn { from { opacity: 0; transform: translateY(12px) scale(.97); } }
@keyframes pwbBodyIn { from { opacity: 0; transform: translateY(6px); } }
@media (prefers-reduced-motion: reduce) {
  .pwb *, .pwb *::before, .pwb *::after { animation: none !important; transition: none !important; }
}
`;
  var portalTarget = () => document.querySelector(".pwb") || document.body;
  var Switch = ({ on, onChange }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      role: "switch",
      "aria-checked": on,
      className: "pwb-switch" + (on ? " on" : ""),
      onClick: () => onChange(!on),
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pwb-switch-knob" })
    }
  );
  var Empty = ({ icon = "dot", text, small }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "empty" + (small ? " small" : ""), style: small ? { flexDirection: "row", padding: "8px 4px", gap: 6, justifyContent: "flex-start" } : null, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: icon, size: small ? 13 : 22 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: esc(text) })
  ] });
  var AddCard = ({ label, onClick, disabled }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: "addcard", onClick, disabled, title: label, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "plus", size: 20 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: esc(label) })
  ] });
  var MODAL_STACK = [];
  function Modal({ title, onClose, children, wide }) {
    const closeRef = (0, import_react.useRef)(onClose);
    closeRef.current = onClose;
    (0, import_react.useEffect)(() => {
      const tok = /* @__PURE__ */ Symbol();
      MODAL_STACK.push(tok);
      const h = (e) => {
        if (e.key === "Escape" && MODAL_STACK[MODAL_STACK.length - 1] === tok) closeRef.current();
      };
      window.addEventListener("keydown", h);
      return () => {
        const i = MODAL_STACK.indexOf(tok);
        if (i >= 0) MODAL_STACK.splice(i, 1);
        window.removeEventListener("keydown", h);
      };
    }, []);
    return (0, import_react_dom.createPortal)(
      // 延迟到 click 派发后再卸载遮罩，避免 mousedown 关闭、click 落到下层元素造成误触
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pwb-modal-bg", onMouseDown: (e) => {
        if (e.target === e.currentTarget) setTimeout(onClose, 0);
      }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-modal" + (wide ? " wide" : ""), role: "dialog", "aria-modal": "true", "aria-label": title, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-modal-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: esc(title) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn", "aria-label": "Close", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "x", size: 14 }) })
        ] }),
        children
      ] }) }),
      portalTarget()
    );
  }
  function Dialog({ dlg, onDone, t }) {
    const [val, setVal] = (0, import_react.useState)(dlg.initial ?? "");
    const [checked, setChecked] = (0, import_react.useState)(false);
    const inputRef = (0, import_react.useRef)(null);
    const okRef = (0, import_react.useRef)(null);
    (0, import_react.useEffect)(() => {
      const timer = setTimeout(() => {
        const el = dlg.kind === "prompt" ? inputRef.current : okRef.current;
        if (el) {
          el.focus();
          if (el === inputRef.current) el.select();
        }
      }, 40);
      return () => clearTimeout(timer);
    }, [dlg]);
    const cancel = () => onDone(null);
    const submit = () => onDone(dlg.checkboxLabel ? { text: val, checked } : dlg.kind === "prompt" ? val : true);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Modal, { title: dlg.title, onClose: cancel, children: [
      dlg.message ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pwb-dlg-msg", children: esc(dlg.message) }) : null,
      dlg.kind === "prompt" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          ref: inputRef,
          style: { width: "100%" },
          type: dlg.inputType || "text",
          value: val,
          placeholder: dlg.placeholder || "",
          onChange: (e) => setVal(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") submit();
          }
        }
      ) : null,
      dlg.checkboxLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "row", style: { gap: 7, marginTop: 10, cursor: "pointer", fontSize: 12.5 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked, onChange: (e) => setChecked(e.target.checked) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: esc(dlg.checkboxLabel) })
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { justifyContent: "flex-end", marginTop: 14 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: cancel, children: t("cancel") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { ref: okRef, className: dlg.danger ? "danger" : "primary", onClick: submit, children: dlg.okText || t("ok") })
      ] })
    ] });
  }
  function TodoPane({ toast, ask, t, lang }) {
    const [raw, setRaw] = (0, import_react.useState)("");
    const [hash, setHash] = (0, import_react.useState)("");
    const [path, setPath] = (0, import_react.useState)("");
    const [input, setInput] = (0, import_react.useState)("");
    const [view, setView] = (0, import_react.useState)("cal");
    const [calMode, setCalMode] = (0, import_react.useState)("month");
    const [calAnchor, setCalAnchor] = (0, import_react.useState)(() => today());
    const [selDate, setSelDate] = (0, import_react.useState)(() => today());
    const [scope, setScope] = (0, import_react.useState)("month");
    const [showDone, setShowDone] = (0, import_react.useState)(() => {
      try {
        return localStorage.getItem("pwb_todo_done") !== "0";
      } catch {
        return true;
      }
    });
    const setShowDoneKeep = (v) => {
      setShowDone(v);
      try {
        localStorage.setItem("pwb_todo_done", v ? "1" : "0");
      } catch {
      }
    };
    const MONTHS = t("months").split(",");
    const load = (0, import_react.useCallback)(async () => {
      const d = await api("/todo");
      setRaw(d.text);
      setPath(d.path);
      setHash(d.hash);
    }, []);
    (0, import_react.useEffect)(() => {
      load().catch((e) => toast(e.message, true));
    }, [load, toast]);
    const items = (0, import_react.useMemo)(() => parseTodos(raw), [raw]);
    const putTodo = async (text) => {
      try {
        const d = await api("/todo", { method: "PUT", body: JSON.stringify({ text, baseHash: hash }) });
        setHash(d.hash);
        return true;
      } catch (e) {
        if (e.currentText !== void 0) {
          setRaw(e.currentText);
          setHash(e.currentHash);
          toast(t("conflict_todo"), true);
        } else toast(e.message, true);
        return false;
      }
    };
    const save = async (next) => {
      const text = serializeTodos(next, raw);
      setRaw(text);
      await putTodo(text);
    };
    const add = () => {
      const v = input.trim();
      if (!v) return;
      const due = (v.match(/@(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
      const tags = [...v.matchAll(/#([^\s#@]+)/g)].map((x) => x[1]);
      const text = v.replace(/@(\d{4}-\d{2}-\d{2})/g, "").replace(/#([^\s#@]+)/g, "").trim();
      save([...items, { line: -1, done: false, text, tags, due }]);
      setInput("");
    };
    const toggle = (line, done2) => save(items.map((it) => it.line === line ? { ...it, done: done2 } : it));
    const del = (line) => {
      const lines = raw.split(/\r?\n/);
      lines.splice(line, 1);
      const text = lines.join("\n");
      setRaw(text);
      putTodo(text);
    };
    const open = items.filter((x) => !x.done);
    const overdue = open.filter((x) => x.due && x.due < today());
    const active = open.filter((x) => !(x.due && x.due < today()));
    const done = items.filter((x) => x.done);
    const byTag = /* @__PURE__ */ new Map();
    for (const x of items) for (const tg of x.tags.length ? x.tags : [t("untagged")]) {
      if (!byTag.has(tg)) byTag.set(tg, []);
      byTag.get(tg).push(x);
    }
    const dueCls = (d) => d ? d < today() ? " overdue" : d === today() ? " today" : "" : "";
    const t0 = today();
    const wk0 = isoOf(mondayOf(/* @__PURE__ */ new Date()));
    const wk1 = isoOf(addDays(fromISO(wk0), 6));
    const monPrefix = t0.slice(0, 7);
    const scopeMatch = (x, key) => key === "all" ? true : Boolean(x.due) && (key === "today" ? x.due === t0 : key === "week" ? x.due >= wk0 && x.due <= wk1 : x.due.startsWith(monPrefix));
    const scopeCount = (key) => items.filter((x) => !x.done && scopeMatch(x, key)).length;
    const scopeList = items.filter((x) => scopeMatch(x, scope) && (showDone || !x.done));
    const anchor = fromISO(calAnchor);
    let calTitle, calCells;
    if (calMode === "month") {
      calTitle = lang === "en" ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}` : `${anchor.getFullYear()} \u5E74 ${anchor.getMonth() + 1} \u6708`;
      const start = mondayOf(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
      calCells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    } else {
      const start = mondayOf(anchor);
      calCells = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      calTitle = `${isoOf(start)} ~ ${isoOf(addDays(start, 6))}`;
    }
    const navCal = (dir) => {
      const a = fromISO(calAnchor);
      if (calMode === "month") setCalAnchor(isoOf(new Date(a.getFullYear(), a.getMonth() + dir, 1)));
      else setCalAnchor(isoOf(addDays(a, dir * 7)));
    };
    const reschedule = (line, due) => save(items.map((it) => it.line === line ? { ...it, due } : it));
    const addOn = async (due) => {
      const v = await ask.prompt({ title: t("add_todo_title"), message: t("falls_on", { due }), placeholder: t("todo_ph_short") });
      if (!v || !v.trim()) return;
      const tags = [...v.matchAll(/#([^\s#@]+)/g)].map((x) => x[1]);
      save([...items, { line: -1, done: false, text: v.replace(/#([^\s#@]+)/g, "").trim(), tags, due }]);
    };
    const selItems = items.filter((x) => x.due === selDate && (showDone || !x.done));
    const selTitle = (() => {
      const [y, m, d] = selDate.split("-");
      return lang === "en" ? `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}` : `${y} \u5E74 ${Number(m)} \u6708 ${Number(d)} \u65E5`;
    })();
    const item = (x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kitem" + (x.done ? " done" : ""), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: x.done, onChange: (e) => toggle(x.line, e.target.checked) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "txt", children: [
        esc(x.text),
        x.tags.map((tg) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "tag", children: [
          "#",
          esc(tg)
        ] }, tg)),
        x.due ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "due" + dueCls(x.due), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "clock", size: 11 }),
          x.due
        ] }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm", title: t("del"), onClick: () => del(x.line), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "x", size: 12 }) })
    ] }, x.line);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { flexWrap: "wrap" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              style: { flex: 1, minWidth: 200 },
              placeholder: t("todo_ph"),
              value: input,
              onChange: (e) => setInput(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") add();
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "primary", onClick: add, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "plus", size: 14 }),
            t("add")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pwb-seg mini", children: [["board", t("view_board")], ["cal", t("view_cal")], ["track", t("view_track")]].map(([v, l]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: view === v ? "on" : "", onClick: () => setView(v), children: l }, v)) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "muted", style: { marginTop: 7, display: "flex", alignItems: "center", gap: 5 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "folder", size: 12 }),
          t("stored_at", { path })
        ] })
      ] }),
      view === "board" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kanban", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kcol", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", { className: "c-overdue", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "clock", size: 13 }),
            t("overdue"),
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "count", children: overdue.length })
          ] }),
          overdue.length ? overdue.map(item) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { small: true, icon: "checkCircle", text: t("no_overdue") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kcol", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", { className: "c-active", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "flame", size: 13 }),
            t("inprog"),
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "count", children: active.length })
          ] }),
          active.length ? active.map(item) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { small: true, icon: "dot", text: t("no_inprog") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kcol", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", { className: "c-done", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "checkCircle", size: 13 }),
            t("done"),
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "count", children: done.length })
          ] }),
          done.length ? done.slice(-30).reverse().map(item) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { small: true, icon: "dot", text: t("no_done") })
        ] })
      ] }) : view === "cal" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "calwrap", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "nav-chips", children: [["today", t("scope_today")], ["week", t("scope_week")], ["month", t("scope_month")], ["all", t("all")]].map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "chip" + (scope === key ? " on" : ""), onClick: () => setScope(key), children: [
            label,
            " ",
            scopeCount(key)
          ] }, key)) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { margin: "2px 0 10px", gap: 8 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, { on: showDone, onChange: setShowDoneKeep }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", children: t("show_done") })
          ] }),
          scopeList.length ? scopeList.map(item) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "calendar", text: t("none_in_range") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "calhead", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "calnav", title: t("prev"), onClick: () => navCal(-1), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "chevronLeft", size: 15 }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: calTitle }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "calnav", title: t("next"), onClick: () => navCal(1), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "chevronRight", size: 15 }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "mini", onClick: () => {
              setCalAnchor(today());
              setSelDate(today());
            }, children: t("scope_today") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "spacer" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-seg mini", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: calMode === "month" ? "on" : "", onClick: () => setCalMode("month"), children: t("seg_month") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: calMode === "week" ? "on" : "", onClick: () => setCalMode("week"), children: t("seg_week") })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "callegend", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "calchip", children: t("legend_open") }),
            t("legend_drag"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "calchip overdue", children: t("legend_overdue") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "calchip done", children: t("legend_done") }),
            t("legend_done_note")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "calgrid", children: [
            t("weekdays").split(",").map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "calwd", children: w }, w)),
            calCells.map((d) => {
              const iso = isoOf(d);
              const dayItems = items.filter((x) => x.due === iso && (showDone || !x.done));
              const cls = "calcell" + (iso === t0 ? " today" : "") + (calMode === "month" && iso.slice(0, 7) !== calAnchor.slice(0, 7) ? " dim" : "") + (iso === selDate ? " sel" : "");
              return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  className: cls,
                  title: `${iso} \xB7 ${t("click_select")}`,
                  onClick: () => setSelDate(iso),
                  onDragOver: (e) => e.preventDefault(),
                  onDragEnter: (e) => e.currentTarget.classList.add("dragover"),
                  onDragLeave: (e) => e.currentTarget.classList.remove("dragover"),
                  onDrop: (e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("dragover");
                    const line = Number(e.dataTransfer.getData("text/pwb-line"));
                    if (line >= 0) reschedule(line, iso);
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "calnum", children: d.getDate() }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        className: "cal-add",
                        title: t("cal_add_tip"),
                        onClick: (e) => {
                          e.stopPropagation();
                          addOn(iso);
                        },
                        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "plus", size: 11 })
                      }
                    ),
                    dayItems.map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                      "span",
                      {
                        className: "calchip" + (x.done ? " done" : x.due < t0 ? " overdue" : ""),
                        draggable: !x.done,
                        title: t(x.done ? "chip_title_done" : "chip_title", { text: x.text }),
                        onDragStart: (e) => e.dataTransfer.setData("text/pwb-line", String(x.line)),
                        onClick: (e) => {
                          e.stopPropagation();
                          toggle(x.line, !x.done);
                        },
                        children: [
                          x.done ? "\u2713 " : "",
                          esc(x.text)
                        ]
                      },
                      x.line
                    ))
                  ]
                },
                iso
              );
            })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "caldetail", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: selTitle }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", children: t("n_items", { n: selItems.length }) }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "spacer" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "mini", onClick: () => addOn(selDate), children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "plus", size: 12 }),
                t("add_todo")
              ] })
            ] }),
            selItems.length ? selItems.map(item) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { small: true, icon: "dot", text: t("none_this_day") })
          ] })
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12, alignItems: "start" }, children: [
        [...byTag.entries()].map(([tag, list]) => {
          const dn = list.filter((x) => x.done).length;
          const pct = list.length ? Math.round(dn / list.length * 100) : 0;
          const od = list.filter((x) => !x.done && x.due && x.due < today()).length;
          const open5 = list.filter((x) => !x.done).slice(0, 5);
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "card", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: esc(tag) }),
              " ",
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "muted", children: [
                dn,
                "/",
                list.length
              ] }),
              od ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "due overdue", children: t("n_overdue", { n: od }) }) : null
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bar", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { width: pct + "%" } }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 8 }, children: [
              open5.map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "track-item", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tdot" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "t", children: [
                  esc(x.text),
                  x.due ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "due" + dueCls(x.due), children: x.due }) : null
                ] })
              ] }, x.line)),
              !open5.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { gap: 5, color: "var(--pwb-ok-fg)", fontSize: 12.5 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "check", size: 13 }),
                t("all_done")
              ] }) : null
            ] })
          ] }, tag);
        }),
        !byTag.size ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "calendar", text: t("no_todos_yet") }) : null
      ] })
    ] });
  }
  function NavPane({ toast, ask, t }) {
    const [nav, setNav] = (0, import_react.useState)(null);
    const [navHash, setNavHash] = (0, import_react.useState)("");
    const [cur, setCur] = (0, import_react.useState)(-1);
    const [adding, setAdding] = (0, import_react.useState)(false);
    const [checking, setChecking] = (0, import_react.useState)(false);
    const [linkCheck, setLinkCheck] = (0, import_react.useState)(null);
    const [form, setForm] = (0, import_react.useState)({ title: "", url: "", cat: 0 });
    const load = (0, import_react.useCallback)(async () => {
      const d = await api("/nav");
      setNavHash(d.hash);
      setNav(d.nav?.categories?.length ? d.nav : { categories: [] });
    }, []);
    (0, import_react.useEffect)(() => {
      load().catch((e) => toast(e.message, true));
    }, [load, toast]);
    const persist = async (next) => {
      setNav(next);
      try {
        const d = await api("/nav", { method: "PUT", body: JSON.stringify({ nav: next, baseHash: navHash }) });
        setNavHash(d.hash);
      } catch (e) {
        if (e.currentNav !== void 0) {
          setNavHash(e.currentHash);
          setNav(e.currentNav?.categories?.length ? e.currentNav : { categories: [] });
          toast(t("conflict_nav"), true);
        } else toast(e.message, true);
      }
    };
    if (!nav) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "muted", children: "\u2026" });
    const cats = nav.categories;
    const viewingAll = cur === -1;
    const active = cats[cur] ?? null;
    const allCount = cats.reduce((n, c) => n + (c.links?.length ?? 0), 0);
    const openLink = (url) => {
      try {
        window.open(url, "_blank", "noopener");
      } catch {
        location.href = url;
      }
    };
    const addCat = async () => {
      const name = await ask.prompt({ title: t("new_cat_title"), placeholder: t("cat_ph") });
      if (!name || !name.trim()) return;
      persist({ categories: [...cats, { id: rid(), name: name.trim(), links: [] }] });
    };
    const delCat = async (i) => {
      const ok = await ask.confirm({
        title: t("del_cat_title"),
        danger: true,
        okText: t("ok_del"),
        message: t("del_cat_msg", { name: cats[i].name, n: cats[i].links?.length ?? 0 })
      });
      if (!ok) return;
      const next = { categories: cats.filter((_, j) => j !== i) };
      setCur(0);
      persist(next);
    };
    const addLink = () => {
      if (!form.title.trim() || !form.url.trim()) return;
      let url = form.url.trim();
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      const next = { categories: cats.map((c, i) => i === form.cat ? { ...c, links: [...c.links ?? [], { id: rid(), title: form.title.trim(), url }] } : c) };
      setAdding(false);
      setForm({ title: "", url: "", cat: form.cat });
      persist(next);
    };
    const delLink = (ci, li) => {
      persist({ categories: cats.map((c, i) => i === ci ? { ...c, links: (c.links ?? []).filter((_, j) => j !== li) } : c) });
    };
    const exportHtml = () => {
      const escH = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const now = Math.floor(Date.now() / 1e3);
      let body = "";
      for (const c of cats) {
        body += `	<DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}">${escH(c.name)}</H3>
	<DL><p>
`;
        for (const l of c.links ?? []) body += `		<DT><A HREF="${escH(l.url)}" ADD_DATE="${now}">${escH(l.title || l.url)}</A>
`;
        body += `	</DL><p>
`;
      }
      const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${body}</DL><p>
`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `\u4E66\u7B7E\u5BFC\u51FA_${today()}.html`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast(t("exported", { cats: cats.length, links: allCount }));
    };
    const importHtml = () => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = ".html,.htm,text/html";
      inp.onchange = async () => {
        try {
          const text = await inp.files[0].text();
          const doc = new DOMParser().parseFromString(text, "text/html");
          const rootDl = doc.querySelector("body dl") || doc.querySelector("dl");
          if (!rootDl) throw new Error(t("err_no_dl"));
          const TRANSPARENT = /^(书签栏|书签菜单|收藏夹栏|其他书签|其他收藏夹|移动设备书签|bookmarks?( bar)?|favorites( bar)?|mobile bookmarks|imported.*|已导入.*)$/i;
          const out = { cats: /* @__PURE__ */ new Map(), order: [] };
          const walk = (dl, bucket, childPrefix, depth) => {
            if (!out.cats.has(bucket)) {
              out.cats.set(bucket, []);
              out.order.push(bucket);
            }
            const curBucket = out.cats.get(bucket);
            const children = [...dl.children];
            for (let i = 0; i < children.length; i++) {
              const el = children[i];
              if (el.tagName !== "DT") continue;
              const h3 = el.querySelector(":scope > h3");
              const a = el.querySelector(":scope > a");
              let nested = el.querySelector(":scope > dl");
              if (!nested) {
                for (let j = i + 1; j < children.length; j++) {
                  if (children[j].tagName === "DL") {
                    nested = children[j];
                    i = j;
                    break;
                  }
                  if (children[j].tagName === "DT") break;
                }
              }
              if (h3 && nested) {
                const name = (h3.textContent || "").trim() || "Untitled";
                if (depth === 0 && TRANSPARENT.test(name)) walk(nested, name, childPrefix, depth);
                else {
                  const full = childPrefix + name;
                  walk(nested, full, full + "/", depth + 1);
                }
              } else if (a) {
                const url = a.getAttribute("href") || "";
                if (/^https?:/i.test(url)) curBucket.push({ url, title: ((a.textContent || "").trim() || url).slice(0, 200) });
              }
            }
          };
          walk(rootDl, "\u5BFC\u5165\u4E66\u7B7E", "", 0);
          const imported = out.order.map((name) => ({ name, links: out.cats.get(name) })).filter((c) => c.links.length);
          if (!imported.length) throw new Error(t("err_no_links"));
          const urlKey = (u) => u.replace(/\/+$/, "").replace(/^https?:\/\//i, "").toLowerCase();
          const next = { categories: cats.map((c) => ({ ...c, links: [...c.links ?? []] })) };
          let newCats = 0, newLinks = 0, dup = 0;
          for (const c of imported) {
            let cat = next.categories.find((x) => x.name === c.name);
            if (!cat) {
              cat = { id: rid(), name: c.name, links: [] };
              next.categories.push(cat);
              newCats++;
            }
            const have = new Set(cat.links.map((l) => urlKey(l.url)));
            for (const l of c.links) {
              const k = urlKey(l.url);
              if (have.has(k)) {
                dup++;
                continue;
              }
              cat.links.push({ id: rid(), title: l.title, url: l.url });
              have.add(k);
              newLinks++;
            }
          }
          persist(next);
          toast(t("imported") + ` +${newCats} +${newLinks}` + (dup ? ` (-${dup})` : ""));
        } catch (e) {
          toast(t("import_fail") + e.message, true);
        }
      };
      inp.click();
    };
    const host = (u) => {
      try {
        return new URL(u).hostname;
      } catch {
        return "";
      }
    };
    const onIcoErr = (e, h) => {
      e.currentTarget.onerror = null;
      e.currentTarget.src = letterAvatar(h);
    };
    const checkLinks = async () => {
      if (checking || !nav) return;
      setChecking(true);
      try {
        const d = await api("/nav/check", { method: "POST", body: JSON.stringify(viewingAll ? {} : { category: cur }) });
        const map = {};
        for (const r of d.results) map[r.url] = r;
        setLinkCheck(map);
        toast(t("check_result", { total: d.summary.total, ok: d.summary.ok, bad: d.summary.dead + d.summary.error }));
      } catch (e) {
        toast(e.message, true);
      } finally {
        setChecking(false);
      }
    };
    const navCard = (l, ci, li) => {
      const h = host(l.url);
      const hit = linkCheck?.[l.url];
      const dead = hit && !hit.ok;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          className: "linkcard" + (dead ? " dead" : ""),
          onClick: () => openLink(l.url),
          title: l.url + (dead ? `\uFF08${hit.status || "ERR"}\uFF09` : ""),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "img",
              {
                className: "ico",
                src: `${API}/icon?host=${encodeURIComponent(h)}`,
                alt: "",
                onError: (e) => onIcoErr(e, h)
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "t", children: esc(l.title) }),
            dead ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "due overdue", style: { marginLeft: 4 }, children: hit.status || "ERR" }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm x", title: t("del"), onClick: (e) => {
              e.stopPropagation();
              delLink(ci, li);
            }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "x", size: 11 }) })
          ]
        },
        l.id
      );
    };
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { marginBottom: 10, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "primary", onClick: () => {
          setForm({ ...form, cat: viewingAll ? 0 : cur });
          setAdding(true);
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "plus", size: 14 }),
          t("add_link")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { onClick: addCat, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "plus", size: 14 }),
          t("add_cat")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "mini", onClick: () => active && delCat(cur), disabled: viewingAll || !active, children: t("del_cat") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            className: "mini",
            onClick: checkLinks,
            disabled: checking || !viewingAll && !active,
            title: viewingAll ? t("check_all") : t("check_links"),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "refresh", size: 12 }),
              checking ? t("checking") : viewingAll ? t("check_all") : t("check_links")
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "spacer" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ghost mini", title: t("export_t"), onClick: exportHtml, children: t("export_btn") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ghost mini", title: t("import_t"), onClick: importHtml, children: t("import_btn") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "nav-chips", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "nav-chip" + (viewingAll ? " on" : ""), onClick: () => setCur(-1), title: t("all_tip"), children: [
          t("all"),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", children: allCount })
        ] }),
        cats.map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "nav-chip" + (i === cur ? " on" : ""), onClick: () => setCur(i), onDoubleClick: () => delCat(i), title: t("dbl_del_cat"), children: [
          esc(c.name),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", children: c.links?.length ?? 0 })
        ] }, c.id)),
        !cats.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", children: t("no_cats") }) : null
      ] }),
      viewingAll ? cats.length ? cats.map((c, ci) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "appsec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "folder", size: 13 }),
          esc(c.name),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", children: c.links?.length ?? 0 })
        ] }),
        (c.links ?? []).length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "linkgrid", children: c.links.map((l, li) => navCard(l, ci, li)) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { small: true, icon: "compass", text: t("no_links_cat") })
      ] }, c.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "compass", text: t("no_links_all") }) : active ? (active.links ?? []).length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "linkgrid", children: active.links.map((l, li) => navCard(l, cur, li)) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "compass", text: t("no_links_cat") }) : null,
      adding ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Modal, { title: t("add_link_title"), onClose: () => setAdding(false), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("name") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: form.title, onChange: (e) => setForm({ ...form, title: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("url_label") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { placeholder: "https://\u2026", value: form.url, onChange: (e) => setForm({ ...form, url: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("category") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: form.cat, onChange: (e) => setForm({ ...form, cat: Number(e.target.value) }), children: cats.map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: i, children: esc(c.name) }, c.id)) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { justifyContent: "flex-end", marginTop: 12 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setAdding(false), children: t("cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "primary", onClick: addLink, children: t("save") })
        ] })
      ] }) : null
    ] });
  }
  function AppsPane({ toast, ask, t }) {
    const [data, setData] = (0, import_react.useState)(null);
    const [q, setQ] = (0, import_react.useState)("");
    const [busy, setBusy] = (0, import_react.useState)("");
    const load = (0, import_react.useCallback)(async () => {
      const d = await api("/apps");
      setData(d);
    }, []);
    (0, import_react.useEffect)(() => {
      load().catch((e) => toast(e.message, true));
    }, [load, toast]);
    if (!data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "muted", children: "\u2026" });
    const pinnedList = (data.pinned || []).map(
      (f) => data.apps.find((a) => a.file === f) ?? { file: f, name: f.replace(/\.(lnk|url)$/iu, ""), missing: true }
    );
    const restList = data.apps.filter((a) => !(data.pinned || []).includes(a.file));
    const kw = q.trim().toLowerCase();
    const matches = data.apps.filter((a) => !kw || a.name.toLowerCase().includes(kw) || a.file.toLowerCase().includes(kw));
    const launch = async (a) => {
      if (busy) return;
      setBusy(a.file);
      try {
        await api("/apps/launch", { method: "POST", body: JSON.stringify({ file: a.file }) });
        toast(t("launched", { name: a.name }));
      } catch (e) {
        toast(e.message, true);
      } finally {
        setBusy("");
      }
    };
    const togglePin = async (a) => {
      const cur = data.pinned || [];
      const next = cur.includes(a.file) ? cur.filter((f) => f !== a.file) : [...cur, a.file];
      try {
        await api("/apps/prefs", { method: "PUT", body: JSON.stringify({ pinned: next }) });
        load();
      } catch (e) {
        toast(e.message, true);
      }
    };
    const setDir = async () => {
      const dir = await ask.prompt({
        title: t("set_dir_title"),
        initial: data.dir || "",
        message: t("set_dir_msg")
      });
      if (dir === null) return;
      try {
        await api("/apps/prefs", { method: "PUT", body: JSON.stringify({ dir }) });
        await load();
        toast(t("dir_updated"));
      } catch (e) {
        toast(e.message, true);
      }
    };
    const openFolder = async () => {
      try {
        await api("/apps/open-folder", { method: "POST", body: "{}" });
      } catch (e) {
        toast(e.message, true);
      }
    };
    const card = (a) => {
      const isPinned = (data.pinned || []).includes(a.file);
      if (a.missing) {
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "appcard missing pinned", title: t("missing_title", { file: a.file }), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", { className: "ico", src: letterAvatar(a.name), alt: "" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "t", children: esc(a.name) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "badge down", children: t("missing_tag") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "pin", title: t("unpin_title"), onClick: () => togglePin(a), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "star", size: 14, filled: true }) })
        ] }, "missing:" + a.file);
      }
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          className: "appcard" + (isPinned ? " pinned" : "") + (busy === a.file ? " busy" : ""),
          onClick: () => launch(a),
          title: t("card_title", { file: a.file }),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "img",
              {
                className: "ico",
                src: `${API}/appicon?file=${encodeURIComponent(a.file)}`,
                alt: "",
                loading: "lazy",
                onError: (e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = letterAvatar(a.name);
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "t", children: esc(a.name) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                className: "pin",
                title: isPinned ? t("unpin_title") : t("pin_title"),
                onClick: (e) => {
                  e.stopPropagation();
                  togglePin(a);
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "star", size: 14, filled: isPinned })
              }
            )
          ]
        },
        a.file
      );
    };
    const grid = (list) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "appgrid", children: list.map(card) });
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-search", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "search", size: 14 }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { placeholder: t("search_apps", { n: data.apps.length }), value: q, onChange: (e) => setQ(e.target.value) }),
          q ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm pwb-search-clear", title: t("del"), onClick: () => setQ(""), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "x", size: 11 }) }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn", title: t("open_folder"), disabled: !data.dir || !data.dirExists, onClick: openFolder, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "folder", size: 16 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn", title: t("refresh"), onClick: load, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "refresh", size: 15 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "mini", onClick: setDir, children: t("set_folder") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "muted", style: { margin: "7px 2px 0" }, children: data.dir ? data.dirExists ? t("dir_line", { dir: data.dir }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: "var(--pwb-bad-fg)" }, children: t("dir_missing", { dir: data.dir }) }) : t("dir_unset") }),
      kw ? matches.length ? grid(matches) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "search", text: t("no_match", { q }) }) : pinnedList.length || restList.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        pinnedList.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "appsec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "star", size: 13, filled: true }),
          t("pinned"),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", children: pinnedList.length })
        ] }) : null,
        pinnedList.length ? grid(pinnedList) : null,
        restList.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "appsec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "server", size: 13 }),
          t("all_apps"),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", children: restList.length })
        ] }) : null,
        restList.length ? grid(restList) : null
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "folder", text: t("empty_apps") })
    ] });
  }
  var CRED_TYPES = [["password", "cred_pw"], ["private-key", "cred_pk"], ["token", "cred_tok"]];
  function AssetsPane({ toast, ask, t, onAiChat }) {
    const [data, setData] = (0, import_react.useState)(null);
    const [grp, setGrp] = (0, import_react.useState)("");
    const [adding, setAdding] = (0, import_react.useState)(false);
    const [detail, setDetail] = (0, import_react.useState)(null);
    const [revealed, setRevealed] = (0, import_react.useState)({});
    const [linkTarget, setLinkTarget] = (0, import_react.useState)(null);
    const [linkForm, setLinkForm] = (0, import_react.useState)({ label: "", url: "" });
    const [vault, setVault] = (0, import_react.useState)({ enabled: false, unlocked: false });
    const [form, setForm] = (0, import_react.useState)({ name: "", host: "", port: "", grp: "", project: "", note: "", credType: "password", credLabel: "", credUser: "", credSecret: "", credPass: "", credExpires: "", tokenFile: null });
    const [editingId, setEditingId] = (0, import_react.useState)(null);
    const [editingCredId, setEditingCredId] = (0, import_react.useState)(null);
    const [editCredCount, setEditCredCount] = (0, import_react.useState)(0);
    const [credMgmt, setCredMgmt] = (0, import_react.useState)(null);
    const [credForm, setCredForm] = (0, import_react.useState)({ label: "", username: "", secret: "", passphrase: "", expires: "" });
    const credTypeLabel = (type) => {
      const hit = CRED_TYPES.find(([v]) => v === type);
      return hit ? t(hit[1]) : String(type ?? "");
    };
    const loadVault = (0, import_react.useCallback)(async () => {
      try {
        setVault(await api("/vault"));
      } catch {
      }
    }, []);
    const load = (0, import_react.useCallback)(async () => {
      const d = await api("/assets");
      setData(d);
    }, []);
    (0, import_react.useEffect)(() => {
      load().catch((e) => toast(e.message, true));
      loadVault();
    }, [load, loadVault, toast]);
    const vaultAction = async (action) => {
      const conf = {
        enable: { title: t("vault_enable_t"), message: t("vault_enable_msg") },
        unlock: { title: t("vault_unlock_t"), message: t("vault_unlock_msg") },
        disable: { title: t("vault_disable_t"), message: t("vault_disable_msg") }
      }[action] ?? {};
      const res = await ask.prompt({
        title: conf.title,
        message: conf.message,
        inputType: "password",
        placeholder: t("vault_ph"),
        checkboxLabel: action === "unlock" ? t("vault_remember") : void 0
      });
      const passphrase = typeof res === "string" ? res : String(res?.text ?? "");
      const remember = typeof res === "object" && Boolean(res?.checked);
      if (action !== "lock" && !passphrase) return;
      try {
        const d = await api(`/vault/${action}`, { method: "POST", body: JSON.stringify({ passphrase, remember }) });
        setVault({ enabled: d.enabled, unlocked: d.unlocked });
        toast(action === "enable" ? t("enc_enabled_toast") : action === "unlock" ? t("unlocked_toast") : action === "lock" ? t("locked_toast") : t("enc_disabled_toast"));
        load();
      } catch (e) {
        toast(e.message, true);
      }
    };
    if (!data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "muted", children: "\u2026" });
    const groups = data.groups;
    const ungrouped = data.assets.filter((a) => !a.grp);
    const shown = grp ? data.assets.filter((a) => a.grp === grp) : data.assets;
    const detailAsset = detail ? data.assets.find((x) => x.id === detail) ?? null : null;
    const check = async (id) => {
      toast(t("probe_toast"));
      try {
        const d = await api(`/assets/${id}/check`, { method: "POST", body: "{}" });
        toast(d.ok ? t("probe_up") : t("probe_down"));
        load();
      } catch (e) {
        toast(e.message, true);
      }
    };
    const reveal = async (cid) => {
      if (revealed[cid]) {
        setRevealed({ ...revealed, [cid]: null });
        return;
      }
      try {
        const d = await api(`/credentials/${cid}/secret`);
        setRevealed({ ...revealed, [cid]: d });
      } catch (e) {
        toast(t("decrypt_fail") + e.message, true);
      }
    };
    const copy = async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        toast(t("copied"));
      } catch {
        toast(t("copy_fail"), true);
      }
    };
    const del = async (a) => {
      const ok = await ask.confirm({ title: t("dlg_del_asset"), danger: true, okText: t("ok_del"), message: t("dlg_del_asset_msg", { name: a.name }) });
      if (!ok) return;
      await api(`/assets/${a.id}`, { method: "DELETE" });
      setDetail((d) => d === a.id ? null : d);
      load();
    };
    const openUrl = (url) => {
      try {
        window.open(url, "_blank", "noopener");
      } catch {
        location.href = url;
      }
    };
    const addLink = async () => {
      let url = linkForm.url.trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      try {
        await api(`/assets/${linkTarget}/links`, { method: "POST", body: JSON.stringify({ label: linkForm.label.trim() || url, url }) });
        setLinkTarget(null);
        setLinkForm({ label: "", url: "" });
        load();
      } catch (e) {
        toast(e.message, true);
      }
    };
    const delLink = async (a, idx) => {
      try {
        await api(`/assets/${a.id}/links/${idx}`, { method: "DELETE" });
        load();
      } catch (e) {
        toast(e.message, true);
      }
    };
    const openEdit = (a) => {
      const firstCred = (a.credentials ?? [])[0] ?? null;
      setEditingId(a.id);
      setEditingCredId(firstCred?.id ?? null);
      setEditCredCount((a.credentials ?? []).length);
      setForm({
        name: a.name,
        host: a.host,
        port: a.port,
        grp: a.grp,
        project: a.project,
        note: a.note,
        credType: firstCred?.type ?? "password",
        credLabel: firstCred?.label ?? "",
        credUser: firstCred?.username ?? "",
        credSecret: "",
        credPass: "",
        credExpires: firstCred?.expires ?? "",
        tokenFile: null
      });
      setAdding(true);
    };
    const openCredMgmt = (a, c) => {
      setCredMgmt({ asset: a, cred: c });
      setCredForm({ label: c.label ?? "", username: c.username ?? "", secret: "", passphrase: "", expires: c.expires ?? "" });
    };
    const saveCred = async () => {
      const { cred } = credMgmt;
      const body = { label: credForm.label, username: credForm.username, expires: credForm.expires };
      if (credForm.secret) body.secret = credForm.secret;
      if (cred.type === "private-key") body.passphrase = credForm.passphrase;
      try {
        await api(`/credentials/${cred.id}`, { method: "PUT", body: JSON.stringify(body) });
        setCredMgmt(null);
        toast(t("cred_updated"));
        load();
      } catch (e) {
        toast(e.message, true);
      }
    };
    const deleteCred = async () => {
      const ok = await ask.confirm({ title: t("cred_delete"), danger: true, okText: t("ok_del"), message: t("cred_delete_msg") });
      if (!ok) return;
      try {
        await api(`/credentials/${credMgmt.cred.id}`, { method: "DELETE" });
        setCredMgmt(null);
        toast(t("cred_updated"));
        load();
      } catch (e) {
        toast(e.message, true);
      }
    };
    const renameGroup = async (g) => {
      const to = await ask.prompt({ title: t("grp_rename_title"), initial: g, placeholder: g });
      if (!to || !to.trim() || to.trim() === g) return;
      try {
        await api("/groups/rename", { method: "PUT", body: JSON.stringify({ from: g, to: to.trim() }) });
        if (grp === g) setGrp(to.trim());
        toast(t("grp_renamed"));
        load();
      } catch (e) {
        toast(e.message, true);
      }
    };
    const create = async () => {
      if (!form.name.trim()) return toast(t("name_required"), true);
      if (!editingId && form.credType === "token" && !form.tokenFile) return toast(t("token_pick_first"), true);
      try {
        if (editingId) {
          let tokenPath2 = null;
          if (form.credType === "token" && form.tokenFile) {
            const up = await api("/uploads/token", {
              method: "POST",
              body: JSON.stringify({ assetName: form.name.trim(), name: form.tokenFile.name, contentBase64: form.tokenFile.base64 })
            });
            tokenPath2 = up.path;
            toast(t("token_saved_to") + " " + up.path);
          }
          await api(`/assets/${editingId}`, {
            method: "PUT",
            body: JSON.stringify({ name: form.name.trim(), host: form.host.trim(), port: form.port.trim(), grp: form.grp.trim(), project: form.project.trim(), note: form.note.trim() })
          });
          if (editingCredId) {
            const credBody = { type: form.credType, label: form.credLabel, username: form.credUser, expires: form.credExpires };
            if (tokenPath2) credBody.secret = tokenPath2;
            else if (form.credSecret.trim()) credBody.secret = form.credSecret.trim();
            if (form.credType === "private-key" && form.credPass) credBody.passphrase = form.credPass;
            await api(`/credentials/${editingCredId}`, { method: "PUT", body: JSON.stringify(credBody) });
          } else if (form.credSecret.trim() || tokenPath2) {
            await api(`/assets/${editingId}/credentials`, {
              method: "POST",
              body: JSON.stringify({
                type: form.credType,
                label: form.credLabel || (form.credType === "token" ? form.tokenFile.name : ""),
                username: form.credUser,
                secret: tokenPath2 || form.credSecret.trim(),
                passphrase: form.credType === "private-key" ? form.credPass || void 0 : void 0,
                expires: form.credExpires || void 0
              })
            });
          }
          setAdding(false);
          setEditingId(null);
          setEditingCredId(null);
          setForm({ name: "", host: "", port: "", grp: "", project: "", note: "", credType: "password", credLabel: "", credUser: "", credSecret: "", credPass: "", credExpires: "", tokenFile: null });
          toast(t("asset_updated"));
          load();
          return;
        }
        let tokenPath = null;
        if (form.credType === "token") {
          const up = await api("/uploads/token", {
            method: "POST",
            body: JSON.stringify({ assetName: form.name.trim(), name: form.tokenFile.name, contentBase64: form.tokenFile.base64 })
          });
          tokenPath = up.path;
          toast(t("token_saved_to") + " " + up.path);
        }
        const secretValue = form.credType === "token" ? tokenPath : form.credSecret.trim();
        const body = {
          name: form.name.trim(),
          host: form.host.trim(),
          port: form.port.trim(),
          grp: form.grp.trim(),
          project: form.project.trim(),
          note: form.note.trim(),
          credentials: secretValue ? [{
            type: form.credType,
            label: form.credLabel || (form.credType === "token" ? form.tokenFile.name : ""),
            username: form.credUser,
            secret: secretValue,
            passphrase: form.credType === "private-key" ? form.credPass || void 0 : void 0,
            expires: form.credExpires || void 0
          }] : []
        };
        await api("/assets", { method: "POST", body: JSON.stringify(body) });
        setAdding(false);
        setForm({ name: "", host: "", port: "", grp: "", project: "", note: "", credType: "password", credLabel: "", credUser: "", credSecret: "", credPass: "", credExpires: "", tokenFile: null });
        toast(t("added"));
        load();
      } catch (e) {
        toast(e.message, true);
      }
    };
    const editExpires = async (c) => {
      const next = await ask.prompt({ title: t("exp_title"), message: t("exp_msg"), initial: c.expires || "" });
      if (next === null) return;
      try {
        await api(`/credentials/${c.id}`, { method: "PUT", body: JSON.stringify({ expires: next }) });
        load();
      } catch (e) {
        toast(e.message, true);
      }
    };
    const fmtSize = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
    const pickTokenFile = () => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.onchange = () => {
        const file = inp.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return toast(t("token_too_big"), true);
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = String(reader.result || "").split(",")[1] || "";
          setForm((f) => ({ ...f, tokenFile: { name: file.name, size: file.size, base64 } }));
        };
        reader.readAsDataURL(file);
      };
      inp.click();
    };
    const assetCard = (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "acard", title: a.name, onClick: () => setDetail(a.id), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "name", children: esc(a.name) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "badge " + (a.last_status === "up" ? "up" : a.last_status === "down" ? "down" : ""), children: a.last_status === "up" ? t("online") : a.last_status === "down" ? t("offline") : t("unknown") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "a-line", style: { marginTop: 3 }, children: [
        esc(a.host),
        a.port ? ":" + esc(a.port) : "",
        a.project ? " \xB7 " + esc(a.project) : "",
        a.last_check ? " \xB7 " + esc(a.last_check.slice(0, 16)).replace("T", " ") : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "a-line", style: { marginTop: 2 }, children: a.note ? esc(a.note) : (a.credentials || []).length || (a.links || []).length ? t("ad_summary", { c: (a.credentials || []).length, l: (a.links || []).length }) : "" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "card-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm", title: t("ai_asset_btn"), onClick: (e) => {
          e.stopPropagation();
          onAiChat(a);
        }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "flame", size: 13 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm", title: t("edit"), onClick: (e) => {
          e.stopPropagation();
          openEdit(a);
        }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "edit", size: 13 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm red", title: t("del"), onClick: (e) => {
          e.stopPropagation();
          del(a);
        }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "trash", size: 13 }) })
      ] })
    ] }, a.id);
    const openAdd = () => {
      setEditingId(null);
      setEditingCredId(null);
      setForm({ name: "", host: "", port: "", grp, project: "", note: "", credType: "password", credLabel: "", credUser: "", credSecret: "", credPass: "", credExpires: "", tokenFile: null });
      setAdding(true);
    };
    const addCard = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AddCard, { label: t("add_asset"), onClick: openAdd });
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { flexWrap: "wrap" }, children: [
        vault.enabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "button",
            {
              className: vault.unlocked ? "" : "mini",
              title: vault.unlocked ? t("enc_lock_tip") : t("enc_unlock_tip"),
              onClick: () => vaultAction(vault.unlocked ? "lock" : "unlock"),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: vault.unlocked ? "unlock" : "lock", size: 13 }),
                vault.unlocked ? t("enc_lock") : t("enc_unlock")
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ghost mini", title: t("enc_disable_tip"), onClick: () => vaultAction("disable"), children: t("enc_disable") })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "mini", title: t("enc_enable_tip"), onClick: () => vaultAction("enable"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "lock", size: 13 }),
          t("enc_enable")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "spacer" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "nav-chips", style: { marginTop: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "chip" + (!grp ? " on" : ""), onClick: () => setGrp(""), children: t("all_n", { n: data.assets.length }) }),
        groups.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "chip" + (grp === g ? " on" : ""), onClick: () => setGrp(grp === g ? "" : g), children: esc(g) }, g))
      ] }),
      grp ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        !shown.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "server", text: t("no_assets") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "assetgrid", style: { marginTop: shown.length ? 4 : 12 }, children: [
          shown.map(assetCard),
          addCard
        ] })
      ] }) : data.assets.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 2 }, children: [
        ...groups.map((g) => ({ label: g, list: data.assets.filter((a) => a.grp === g) })),
        { label: t("ungrouped"), list: ungrouped }
      ].filter((s) => s.list.length).map((s, i, all) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "appsec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "folder", size: 13 }),
          esc(s.label),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", children: s.list.length }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm", title: t("grp_dbl_rename"), onClick: () => renameGroup(s.label), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "edit", size: 12 }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "assetgrid", children: [
          s.list.map(assetCard),
          i === all.length - 1 ? addCard : null
        ] })
      ] }, s.label)) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "server", text: t("no_assets") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "assetgrid", children: addCard })
      ] }),
      detailAsset ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Modal, { title: detailAsset.name, wide: true, onClose: () => setDetail(null), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { flexWrap: "wrap", gap: 6 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "badge " + (detailAsset.last_status === "up" ? "up" : detailAsset.last_status === "down" ? "down" : ""), children: detailAsset.last_status === "up" ? t("online") : detailAsset.last_status === "down" ? t("offline") : t("unknown") }),
          detailAsset.grp ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "badge", children: esc(detailAsset.grp) }) : null,
          detailAsset.last_check ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", style: { fontSize: 12, fontVariantNumeric: "tabular-nums" }, children: esc(detailAsset.last_check.slice(0, 16)).replace("T", " ") }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "detail-kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "k", children: t("f_host") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "v", children: [
            esc(detailAsset.host),
            detailAsset.port ? ":" + esc(detailAsset.port) : ""
          ] }),
          detailAsset.project ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "k", children: t("f_project") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "v", children: esc(detailAsset.project) })
          ] }) : null,
          detailAsset.note ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "k", children: t("f_notes") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "v", children: esc(detailAsset.note) })
          ] }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "detail-sec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sec-title", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "link", size: 13 }),
            t("ad_links")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }, children: [
            (detailAsset.links || []).map((l, li) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { position: "relative", display: "inline-flex" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "alink", title: l.url, onClick: () => openUrl(l.url), children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "link", size: 11 }),
                esc(l.label || l.url)
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  className: "ibtn sm",
                  title: t("del"),
                  style: { marginLeft: -3, width: 18, height: 18, borderRadius: 999 },
                  onClick: () => delLink(detailAsset, li),
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "x", size: 10 })
                }
              )
            ] }, li)),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "mini", onClick: () => {
              setLinkTarget(detailAsset.id);
              setLinkForm({ label: "", url: "" });
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "plus", size: 12 }),
              t("link_add")
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "detail-sec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sec-title", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "lock", size: 13 }),
            t("cred_section_edit")
          ] }),
          (detailAsset.credentials || []).length ? (detailAsset.credentials || []).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cred-row", children: [
              c.expires ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "badge exp" + (c.expiresInDays < 0 ? " down" : ""), title: t("exp_tip"), onClick: () => editExpires(c), children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "clock", size: 10 }),
                " ",
                esc(c.expires),
                typeof c.expiresInDays === "number" ? c.expiresInDays < 0 ? `\uFF08${t("expired")}\uFF09` : `\uFF08${c.expiresInDays}${t("days")}\uFF09` : ""
              ] }) : null,
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "mini", onClick: () => reveal(c.id), children: [
                revealed[c.id] ? t("hide") : t("reveal"),
                " ",
                esc(c.label || credTypeLabel(c.type))
              ] }),
              revealed[c.id] ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "mini", onClick: () => copy(revealed[c.id].secret), children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "copy", size: 11 }),
                t("copy")
              ] }) : null,
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm", title: t("manage"), onClick: () => openCredMgmt(detailAsset, c), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "sliders", size: 12 }) })
            ] }),
            revealed[c.id] ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cred", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "muted", children: [
                esc(c.username ? c.username + " \xB7 " : ""),
                esc(c.label || credTypeLabel(c.type))
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sec", children: esc(revealed[c.id].secret) }),
              revealed[c.id].passphrase ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { display: "inline-flex", alignItems: "center", gap: 5, flexWrap: "wrap" }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", children: t("f_pp") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sec", children: esc(revealed[c.id].passphrase) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "mini", onClick: () => copy(revealed[c.id].passphrase), children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "copy", size: 11 }),
                  t("copy")
                ] })
              ] }) : null
            ] }) : null
          ] }, c.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "muted", children: t("ad_no_cred") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "mini", onClick: () => check(detailAsset.id), children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "refresh", size: 12 }),
              t("probe")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "mini", onClick: () => onAiChat(detailAsset), children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "flame", size: 12 }),
              t("ai_asset_btn")
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "danger mini", onClick: () => del(detailAsset), children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "trash", size: 12 }),
              t("del")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "primary mini", onClick: () => openEdit(detailAsset), children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "edit", size: 12 }),
              t("edit")
            ] })
          ] })
        ] })
      ] }) : null,
      adding ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Modal, { title: editingId ? t("edit_asset_title") : t("add_asset_title"), wide: true, onClose: () => {
        setAdding(false);
        setEditingId(null);
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_name") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_host") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: form.host, onChange: (e) => setForm({ ...form, host: e.target.value }), placeholder: t("host_ph") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_port") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: form.port, onChange: (e) => setForm({ ...form, port: e.target.value }), placeholder: "22" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_group") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: form.grp, onChange: (e) => setForm({ ...form, grp: e.target.value }), list: "pwb-groups" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", { id: "pwb-groups", children: groups.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: g }, g)) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_project") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: form.project, onChange: (e) => setForm({ ...form, project: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_notes") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: form.note, onChange: (e) => setForm({ ...form, note: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { marginTop: 14 }, children: editingId ? t("cred_section_edit") : t("cred_optional") }),
        editingId && editCredCount > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "muted", style: { margin: "-4px 0 10px" }, children: t("multi_cred_hint", { n: editCredCount }) }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_type") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: form.credType, onChange: (e) => setForm({ ...form, credType: e.target.value, credPass: "" }), children: CRED_TYPES.map(([v, key]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: v, children: t(key) }, v)) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_label") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: form.credLabel, onChange: (e) => setForm({ ...form, credLabel: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_user") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: form.credUser, onChange: (e) => setForm({ ...form, credUser: e.target.value }) })
        ] }),
        form.credType === "token" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_token_file") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { flexWrap: "wrap" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "mini", onClick: pickTokenFile, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "folder", size: 12 }),
              t("token_pick")
            ] }),
            form.tokenFile ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "muted", children: [
              esc(form.tokenFile.name),
              "\uFF08",
              fmtSize(form.tokenFile.size),
              "\uFF09"
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", children: editingId && editingCredId ? t("token_hint_edit") : t("token_hint") })
          ] })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: form.credType === "private-key" ? t("f_pk") : t("f_secret") }),
          form.credType === "private-key" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "textarea",
            {
              rows: 4,
              style: { fontFamily: "ui-monospace, Consolas, monospace", resize: "vertical" },
              placeholder: "-----BEGIN OPENSSH PRIVATE KEY-----",
              value: form.credSecret,
              onChange: (e) => setForm({ ...form, credSecret: e.target.value })
            }
          ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "password", placeholder: editingId && editingCredId ? t("new_secret_ph") : "", value: form.credSecret, onChange: (e) => setForm({ ...form, credSecret: e.target.value }) })
        ] }),
        form.credType === "private-key" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_pp") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "password", placeholder: t("pp_ph"), value: form.credPass, onChange: (e) => setForm({ ...form, credPass: e.target.value }) })
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_exp") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "date", value: form.credExpires, onChange: (e) => setForm({ ...form, credExpires: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { justifyContent: "flex-end", marginTop: 12 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => {
            setAdding(false);
            setEditingId(null);
          }, children: t("cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "primary", onClick: create, children: editingId ? t("save") : t("add") })
        ] })
      ] }) : null,
      credMgmt ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Modal, { title: t("cred_edit_title"), onClose: () => setCredMgmt(null), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_label") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: credForm.label, onChange: (e) => setCredForm({ ...credForm, label: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_user") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: credForm.username, onChange: (e) => setCredForm({ ...credForm, username: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_new_secret") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "password", placeholder: t("new_secret_ph"), value: credForm.secret, onChange: (e) => setCredForm({ ...credForm, secret: e.target.value }) })
        ] }),
        credMgmt.cred.type === "private-key" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_pp") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "password", value: credForm.passphrase, onChange: (e) => setCredForm({ ...credForm, passphrase: e.target.value }) })
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("f_exp") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "date", value: credForm.expires, onChange: (e) => setCredForm({ ...credForm, expires: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { justifyContent: "space-between", marginTop: 12 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "danger", onClick: deleteCred, children: t("cred_delete") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setCredMgmt(null), children: t("cancel") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "primary", onClick: saveCred, children: t("save") })
          ] })
        ] })
      ] }) : null,
      linkTarget ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Modal, { title: t("add_rel_title"), onClose: () => setLinkTarget(null), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("name") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { placeholder: t("rel_name_ph"), value: linkForm.label, onChange: (e) => setLinkForm({ ...linkForm, label: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("url_label") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { placeholder: "https://\u2026", value: linkForm.url, onChange: (e) => setLinkForm({ ...linkForm, url: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { justifyContent: "flex-end", marginTop: 12 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setLinkTarget(null), children: t("cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "primary", onClick: addLink, children: t("save") })
        ] })
      ] }) : null
    ] });
  }
  function NotesPane({ toast, t, lang }) {
    const [raw, setRaw] = (0, import_react.useState)(null);
    const [hash, setHash] = (0, import_react.useState)("");
    const [q, setQ] = (0, import_react.useState)("");
    const [rawMode, setRawMode] = (0, import_react.useState)(false);
    const [rawDraft, setRawDraft] = (0, import_react.useState)("");
    const [editing, setEditing] = (0, import_react.useState)(null);
    const MONTHS = t("months").split(",");
    const load = (0, import_react.useCallback)(async () => {
      const d = await api("/note");
      setRaw(d.text);
      setHash(d.hash);
    }, []);
    (0, import_react.useEffect)(() => {
      load().catch((e) => toast(e.message, true));
    }, [load, toast]);
    const put = async (text) => {
      try {
        const d = await api("/note", { method: "PUT", body: JSON.stringify({ text, baseHash: hash }) });
        setHash(d.hash);
        setRaw(text);
        return true;
      } catch (e) {
        if (e.currentText !== void 0) {
          setRaw(e.currentText);
          setHash(e.currentHash);
          toast(t("note_conflict"), true);
        } else toast(e.message, true);
        return false;
      }
    };
    const entries = (0, import_react.useMemo)(() => {
      if (raw == null) return [];
      const sections = [];
      let cur = null;
      const year = (/* @__PURE__ */ new Date()).getFullYear();
      raw.split(/\r?\n/).forEach((line) => {
        const h = line.match(/^##\s+(.+)$/);
        if (h) {
          cur = { title: h[1].trim(), lines: [] };
          sections.push(cur);
          return;
        }
        if (!cur) {
          if (line.trim()) {
            cur = { title: line.trim().slice(0, 40), lines: [] };
            sections.push(cur);
          }
          return;
        }
        cur.lines.push(line);
      });
      return sections.map((s, i) => {
        const full = s.title.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})$/);
        const short = s.title.match(/^(\d{2})-(\d{2})\s+(\d{2}:\d{2})$/);
        let time = s.title, monthKey = null;
        if (full) {
          time = `${full[2]}-${full[3]} ${full[4]}`;
          monthKey = `${full[1]}-${full[2]}`;
        } else if (short) {
          time = `${short[1]}-${short[2]} ${short[3]}`;
          monthKey = `${year}-${short[1]}`;
        }
        return { idx: i, title: s.title, time, monthKey, body: s.lines.join("\n").trim() };
      });
    }, [raw]);
    const sectionSpans = (text) => {
      const lines = text.split(/\r?\n/);
      const marks = [];
      let cur = null;
      lines.forEach((line, i) => {
        if (/^##\s+/.test(line)) {
          if (cur) cur.end = i;
          cur = { start: i, end: lines.length };
          marks.push(cur);
        }
      });
      return { lines, marks };
    };
    const delEntry = async (idx) => {
      if (raw == null) return;
      const { lines, marks } = sectionSpans(raw);
      const m = marks[idx];
      if (!m) return;
      lines.splice(m.start, m.end - m.start);
      await put(lines.join("\n").replace(/^\n+/, ""));
    };
    const newCard = async () => {
      if (raw == null || editing) return;
      const d = /* @__PURE__ */ new Date();
      const stamp = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      const base = raw.trimEnd();
      const ok = await put((base ? base + "\n\n" : "") + `## ${stamp}
`);
      if (ok) setEditing({ idx: entries.length, text: "" });
    };
    const saveCard = async () => {
      if (!editing || raw == null) return;
      const body = editing.text.trim();
      if (!body) return delEntry(editing.idx);
      const { lines, marks } = sectionSpans(raw);
      const m = marks[editing.idx];
      if (!m) return;
      lines.splice(m.start + 1, m.end - m.start - 1, body);
      const ok = await put(lines.join("\n"));
      if (ok) setEditing(null);
    };
    const cancelCard = () => {
      if (!editing) return;
      if (!editing.text.trim()) delEntry(editing.idx);
      else setEditing(null);
    };
    const saveRaw = async () => {
      const ok = await put(rawDraft);
      if (ok) {
        setRawMode(false);
        setRawDraft("");
      }
    };
    const kw = q.trim().toLowerCase();
    const visible = entries.filter((e) => {
      const isEditingThis = editing && editing.idx === e.idx;
      if (!e.body.trim() && !isEditingThis) return false;
      if (!kw) return true;
      return (e.title + "\n" + e.body).toLowerCase().includes(kw);
    });
    const monthKeys = [...new Set(visible.map((e) => e.monthKey).filter(Boolean))].sort().reverse();
    const earlier = visible.filter((e) => !e.monthKey);
    const monthLabel = (key) => {
      const [y, m] = key.split("-");
      return lang === "en" ? `${MONTHS[Number(m) - 1]} ${y}` : `${y} \u5E74 ${Number(m)} \u6708`;
    };
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "mini", disabled: !!editing, onClick: () => {
          if (!rawMode) setRawDraft(raw ?? "");
          setRawMode(!rawMode);
        }, children: t("note_raw") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "spacer" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-search", style: { maxWidth: 260 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "search", size: 14 }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { placeholder: t("note_search"), value: q, onChange: (e) => setQ(e.target.value) }),
          q ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm pwb-search-clear", onClick: () => setQ(""), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "x", size: 11 }) }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", children: t("note_stats", { entries: visible.filter((e) => e.body.trim()).length, chars: (raw ?? "").length }) })
      ] }),
      rawMode ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "card", style: { marginTop: 12 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "textarea",
          {
            rows: 16,
            style: { width: "100%", fontFamily: "ui-monospace, Consolas, monospace", resize: "vertical" },
            value: rawDraft,
            onChange: (e) => setRawDraft(e.target.value)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { justifyContent: "flex-end", marginTop: 10 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setRawMode(false), children: t("note_raw_cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "primary", onClick: saveRaw, children: t("note_raw_save") })
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 12 }, children: [
        [
          ...monthKeys.map((key) => ({ key, early: false, label: monthLabel(key), items: visible.filter((e) => e.monthKey === key) })),
          ...earlier.length ? [{ key: "_early", early: true, label: t("note_earlier"), items: earlier }] : []
        ].map((s, si, all) => {
          if (!s.items.length) return null;
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "appsec", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "calendar", size: 13 }),
              esc(s.label),
              " ",
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", children: s.items.length })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "note-grid", children: [
              [...s.items].reverse().map((e) => {
                const isEditing = editing && editing.idx === e.idx;
                return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "card note-card" + (isEditing ? " editing" : ""), style: { minWidth: 0 }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "card-actions", children: isEditing ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm", title: t("note_edit"), onClick: () => setEditing({ idx: e.idx, text: e.body }), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "edit", size: 12 }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm red", title: t("note_del"), onClick: () => delEntry(e.idx), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "trash", size: 12 }) })
                  ] }) }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "note-time", children: esc(s.early ? e.title : e.time) }),
                  isEditing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "textarea",
                      {
                        rows: 6,
                        style: { width: "100%", border: "none", background: "transparent", padding: 0, outline: "none", resize: "none", font: "inherit", color: "var(--pwb-text)", display: "block", flex: 1 },
                        value: editing.text,
                        autoFocus: true,
                        onChange: (ev) => setEditing({ ...editing, text: ev.target.value }),
                        onKeyDown: (ev) => {
                          if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) saveCard();
                        }
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { justifyContent: "flex-end", gap: 6 }, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "mini", onClick: cancelCard, children: t("note_cancel") }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "mini primary", onClick: saveCard, children: t("note_save") })
                    ] })
                  ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "note-body", children: esc(e.body) })
                ] }, e.idx);
              }),
              si === all.length - 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AddCard, { label: t("note_new"), onClick: newCard, disabled: !!editing }) : null
            ] })
          ] }, s.key);
        }),
        !visible.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "edit", text: entries.length ? t("note_none_match") : t("note_empty") }),
          kw ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "note-grid", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AddCard, { label: t("note_new"), onClick: newCard, disabled: !!editing }) })
        ] }) : null
      ] })
    ] });
  }
  function KeysPane({ toast, ask, t }) {
    const [docs, setDocs] = (0, import_react.useState)(null);
    const [q, setQ] = (0, import_react.useState)("");
    const [detail, setDetail] = (0, import_react.useState)(null);
    const [draft, setDraft] = (0, import_react.useState)(null);
    const [adding, setAdding] = (0, import_react.useState)(false);
    const [newName, setNewName] = (0, import_react.useState)("");
    const load = (0, import_react.useCallback)(async () => {
      const d = await api("/keysdocs");
      setDocs(d.docs);
    }, []);
    (0, import_react.useEffect)(() => {
      load().catch((e) => toast(e.message, true));
    }, [load, toast]);
    const doc = detail ? (docs ?? []).find((d) => d.name === detail.name && d.ext === detail.ext) : null;
    const docTitle = (d) => d.name + (d.ext === "txt" ? ".txt" : "");
    const save = async () => {
      try {
        const d = await api(`/keysdoc/${encodeURIComponent(detail.name)}`, { method: "PUT", body: JSON.stringify({ text: draft, baseHash: doc.hash, ext: detail.ext }) });
        setDocs((list) => list.map((x) => x.name === detail.name && x.ext === detail.ext ? { ...x, text: draft, hash: d.hash, chars: d.chars, mtime: (/* @__PURE__ */ new Date()).toISOString() } : x));
        setDraft(null);
        toast(t("kd_saved"));
      } catch (e) {
        if (e.currentText !== void 0) {
          setDraft(e.currentText);
          setDocs((list) => list.map((x) => x.name === detail.name && x.ext === detail.ext ? { ...x, text: e.currentText, hash: e.currentHash } : x));
          toast(t("kd_conflict"), true);
        } else toast(e.message, true);
      }
    };
    const removeDoc = async (d) => {
      const ok = await ask.confirm({ title: t("kd_del"), danger: true, okText: t("ok_del"), message: t("kd_del_msg", { name: docTitle(d) }) });
      if (!ok) return;
      try {
        await api(`/keysdoc/${encodeURIComponent(d.name)}?ext=${d.ext}`, { method: "DELETE" });
        if (detail && detail.name === d.name && detail.ext === d.ext) {
          setDetail(null);
          setDraft(null);
        }
        await load();
        toast(t("kd_deleted"));
      } catch (e) {
        toast(e.message, true);
      }
    };
    const createDoc = async () => {
      const name = newName.trim();
      if (!name) return;
      if ((docs ?? []).some((d) => d.name === name && d.ext === "md")) return toast(t("kd_name_exists"), true);
      try {
        await api(`/keysdoc/${encodeURIComponent(name)}`, { method: "PUT", body: JSON.stringify({ text: "", ext: "md" }) });
        await load();
        setDetail({ name, ext: "md" });
        setDraft("");
        setAdding(false);
        setNewName("");
        toast(t("kd_created"));
      } catch (e) {
        toast(e.message, true);
      }
    };
    const importFile = () => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = ".md,.txt,text/markdown,text/plain";
      inp.onchange = async () => {
        const file = inp.files?.[0];
        if (!file) return;
        const hit = file.name.toLowerCase().match(/^(.+)(\.md|\.txt)$/);
        if (!hit) return toast(t("kd_bad_file"), true);
        const ext = hit[2] === ".txt" ? "txt" : "md";
        const name = file.name.slice(0, -hit[2].length).trim();
        if (!name) return toast(t("kd_bad_file"), true);
        if ((docs ?? []).some((d) => d.name === name && d.ext === ext)) return toast(t("kd_name_exists"), true);
        if (file.size > 1024 * 1024) return toast(t("kd_too_big"), true);
        try {
          const text = await file.text();
          await api(`/keysdoc/${encodeURIComponent(name)}`, { method: "PUT", body: JSON.stringify({ text, ext }) });
          await load();
          setDetail({ name, ext });
          setDraft(null);
          setAdding(false);
          toast(t("kd_import_done", { name: name + hit[2] }));
        } catch (e) {
          toast(e.message, true);
        }
      };
      inp.click();
    };
    const kw = q.trim().toLowerCase();
    const filtered = (docs ?? []).filter((d) => !kw || (d.name + "\n" + d.text).toLowerCase().includes(kw));
    const openView = (d, edit = false) => {
      setDetail({ name: d.name, ext: d.ext });
      setDraft(edit ? d.text : null);
    };
    const addCard = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AddCard, { label: t("kd_new"), onClick: () => {
      setNewName("");
      setAdding(true);
    } });
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "row", style: { flexWrap: "wrap" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-search", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "search", size: 14 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { placeholder: t("kd_search"), value: q, onChange: (e) => setQ(e.target.value) }),
        q ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm pwb-search-clear", onClick: () => setQ(""), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "x", size: 11 }) }) : null
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 12 }, children: filtered.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "note-grid", children: [
        filtered.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            className: "card kdoc-card",
            title: t("kd_open_tip"),
            onClick: () => openView(d),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "card-actions", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm", title: t("edit"), onClick: (ev) => {
                  ev.stopPropagation();
                  openView(d, true);
                }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "edit", size: 12 }) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm red", title: t("kd_del"), onClick: (ev) => {
                  ev.stopPropagation();
                  removeDoc(d);
                }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "trash", size: 12 }) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "row", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { className: "note-title", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "file", size: 13 }),
                esc(d.name),
                d.ext === "txt" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", children: ".txt" }) : null
              ] }) }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "muted", style: { marginTop: 4, fontSize: 11.5, fontVariantNumeric: "tabular-nums" }, children: [
                t("kd_chars", { chars: d.chars }),
                " \xB7 ",
                esc(d.mtime.slice(0, 16).replace("T", " "))
              ] }),
              d.text.trim() ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kdoc-preview", children: esc(d.text.split("\n").filter((l) => l.trim()).slice(0, 4).join("\n")) }) : null
            ]
          },
          d.name + "." + d.ext
        )),
        addCard
      ] }) : (docs ?? []).length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "lock", text: t("key_none_match") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "lock", text: t("kd_empty_list") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "note-grid", children: addCard })
      ] }) }),
      detail && doc ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Modal, { title: docTitle(doc), wide: true, onClose: () => {
        if (draft === null) setDetail(null);
        else setDraft(null);
      }, children: draft === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row muted", style: { gap: 10, marginBottom: 8, fontSize: 12, fontVariantNumeric: "tabular-nums" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("kd_chars", { chars: doc.chars }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: esc(doc.mtime.slice(0, 16).replace("T", " ")) })
        ] }),
        doc.text.trim() ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kdoc-view", style: { minHeight: 180, maxHeight: "52vh", overflow: "auto" }, children: esc(doc.text) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "edit", text: t("kd_empty_doc") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { justifyContent: "space-between", marginTop: 12 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "danger mini", onClick: () => removeDoc(doc), children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "trash", size: 12 }),
            t("kd_del")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "primary mini", onClick: () => setDraft(doc.text), children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "edit", size: 12 }),
            t("edit")
          ] })
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "textarea",
          {
            rows: 18,
            style: {
              width: "100%",
              border: "1px solid var(--pwb-border-strong)",
              borderRadius: 8,
              background: "var(--pwb-input-bg)",
              color: "var(--pwb-text)",
              fontFamily: "ui-monospace, Consolas, monospace",
              fontSize: 12.5,
              lineHeight: 1.6,
              resize: "vertical",
              padding: "10px 12px",
              outline: "none",
              display: "block"
            },
            value: draft,
            onChange: (e) => setDraft(e.target.value),
            autoFocus: true
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { justifyContent: "flex-end", marginTop: 10 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "mini", onClick: () => setDraft(null), children: t("cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "primary mini", onClick: save, children: t("save") })
        ] })
      ] }) }) : null,
      adding ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Modal, { title: t("kd_add_title"), onClose: () => setAdding(false), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              style: { flex: 1 },
              placeholder: t("kd_name_ph"),
              value: newName,
              autoFocus: true,
              onChange: (e) => setNewName(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") createDoc();
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "primary", onClick: createDoc, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "plus", size: 13 }),
            t("kd_new")
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kd-or", children: t("kd_or") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { style: { width: "100%" }, onClick: importFile, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "folder", size: 14 }),
          t("kd_import_file")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "muted", style: { marginTop: 8 }, children: t("kd_import_hint") })
      ] }) : null
    ] });
  }
  var TOOL_LABELS = {
    read_todo: "ai_tool_read_todo",
    read_note: "ai_tool_read_note",
    list_assets: "ai_tool_list_assets",
    probe_asset: "ai_tool_probe_asset",
    search_nav: "ai_tool_search_nav",
    list_keydocs: "ai_tool_list_keydocs",
    add_todo: "ai_tool_add_todo",
    add_note: "ai_tool_add_note",
    add_asset: "ai_tool_add_asset",
    ssh_exec: "ai_tool_ssh_exec"
  };
  var mdLite = (src) => {
    const codes = [];
    let s = esc(src);
    s = s.replace(/```([\s\S]*?)```/g, (_, c) => {
      codes.push(c.replace(/^[a-z]*\n/i, ""));
      return "\0" + (codes.length - 1) + "\0";
    });
    s = s.replace(/`([^`\n]+)`/g, "<code class='md-ic'>$1</code>");
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/^#{1,4}\s+(.+)$/gm, "<div class='md-h'>$1</div>");
    s = s.replace(/^[-*]\s+(.+)$/gm, "<div class='md-li'>\u2022 $1</div>");
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => "<pre class='md-code'>" + codes[Number(i)] + "</pre>");
    return s;
  };
  var aiUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  var relTime = (ts) => {
    if (typeof ts === "string" && /^\d+$/.test(ts)) ts = Number(ts);
    const d = new Date(ts);
    const now = /* @__PURE__ */ new Date();
    const hm = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    if (d.toDateString() === now.toDateString()) return hm;
    const md = d.getMonth() + 1 + "-" + d.getDate();
    return d.getFullYear() === now.getFullYear() ? md : d.getFullYear() + "-" + md;
  };
  var applyEv = (msgs, ev) => {
    const cp = [...msgs];
    const last = cp[cp.length - 1];
    if (!last || last.role !== "assistant") return cp;
    if (ev.type === "delta") last.content += ev.text;
    if (ev.type === "tool") last.tools = [...last.tools ?? [], { name: ev.name, args: ev.args, done: false }];
    if (ev.type === "tool_result") {
      const tl = [...last.tools ?? []];
      if (tl.length) tl[tl.length - 1] = { ...tl[tl.length - 1], done: true, rejected: Boolean(ev.rejected) };
      last.tools = tl;
    }
    if (ev.type === "error") {
      last.error = ev.error;
      last.streaming = false;
    }
    if (ev.type === "done") last.streaming = false;
    return cp;
  };
  function AIPane({ toast, ask, t, lang, aiCtx, onClearCtx }) {
    const [sessions, setSessions] = (0, import_react.useState)([]);
    const [activeId, setActiveId] = (0, import_react.useState)(() => {
      try {
        return localStorage.getItem("pwb_ai_active") ?? null;
      } catch {
        return null;
      }
    });
    const [archView, setArchView] = (0, import_react.useState)(false);
    const [listLoaded, setListLoaded] = (0, import_react.useState)(false);
    const migratedRef = (0, import_react.useRef)(false);
    const [, setListTick] = (0, import_react.useState)(0);
    (0, import_react.useEffect)(() => {
      const id = setInterval(() => setListTick((x) => x + 1), 3e4);
      return () => clearInterval(id);
    }, []);
    const [input, setInput] = (0, import_react.useState)("");
    const [streaming, setStreaming] = (0, import_react.useState)(false);
    const [cfg, setCfg] = (0, import_react.useState)(null);
    const [cfgOpen, setCfgOpen] = (0, import_react.useState)(false);
    const [cfgForm, setCfgForm] = (0, import_react.useState)(null);
    const [testState, setTestState] = (0, import_react.useState)(null);
    const [modelSel, setModelSel] = (0, import_react.useState)(() => {
      try {
        return localStorage.getItem("pwb_ai_model") ?? "";
      } catch {
        return "";
      }
    });
    const providerName = (cfg?.providers ?? []).find((p) => p.id === cfg?.provider)?.name ?? cfg?.provider ?? "";
    const scrollRef = (0, import_react.useRef)(null);
    const taRef = (0, import_react.useRef)(null);
    const autoGrowTa = () => {
      const el = taRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 180) + "px";
    };
    const sessionsRef = (0, import_react.useRef)(sessions);
    sessionsRef.current = sessions;
    const active = sessions.find((x) => x.id === activeId) ?? null;
    const msgs = active?.msgs ?? [];
    const persist = (list, id) => {
      setSessions(list);
      sessionsRef.current = list;
      if (id !== void 0) {
        setActiveId(id);
        try {
          localStorage.setItem("pwb_ai_active", id ?? "");
        } catch {
        }
      }
    };
    (0, import_react.useEffect)(() => {
      api("/ai/config").then((d) => setCfg(d)).catch(() => setCfg({ supported: true }));
    }, []);
    const migrateLocalSessions = async () => {
      if (migratedRef.current) return;
      migratedRef.current = true;
      let old = [];
      try {
        old = JSON.parse(localStorage.getItem("pwb_ai_sessions_v1") ?? "[]");
      } catch {
      }
      if (!Array.isArray(old) || !old.length) return;
      for (const s of old.slice(-80)) {
        if (!s?.id) continue;
        try {
          await api(`/ai/sessions/${s.id}`, { method: "PUT", body: JSON.stringify({ title: s.title, asset: s.asset ?? null, created: s.created ?? s.updated, updated: s.updated ?? Date.now(), msgs: s.msgs ?? [] }) });
        } catch {
        }
      }
      try {
        localStorage.removeItem("pwb_ai_sessions_v1");
      } catch {
      }
      loadSessions(false);
    };
    const loadSessions = (0, import_react.useCallback)(async (view = archView) => {
      try {
        const d = await api(`/ai/sessions${view ? "?archived=1" : ""}`);
        setSessions(d.sessions);
        sessionsRef.current = d.sessions;
        setListLoaded(true);
        if (!view) {
          setActiveId((cur) => cur && d.sessions.some((x) => x.id === cur) ? cur : d.sessions[0]?.id ?? null);
          migrateLocalSessions();
        }
      } catch (e) {
        setListLoaded(true);
        toast(e.message, true);
      }
    }, [archView, toast]);
    (0, import_react.useEffect)(() => {
      loadSessions();
    }, [loadSessions]);
    const saveSession = async (session) => {
      if (!session) return;
      try {
        await api(`/ai/sessions/${session.id}`, { method: "PUT", body: JSON.stringify({
          title: session.title,
          asset: session.asset ?? null,
          created: session.created ?? (/* @__PURE__ */ new Date()).toISOString(),
          updated: Date.now(),
          msgs: session.msgs ?? []
        }) });
      } catch (e) {
        toast(t("ai_persist_fail") + e.message, true);
      }
    };
    const archiveSession = async (id, unarchive) => {
      try {
        await api(`/ai/sessions/${id}/${unarchive ? "unarchive" : "archive"}`, { method: "POST", body: "{}" });
      } catch (e) {
        toast(e.message, true);
        return;
      }
      if (unarchive) setArchView(false);
      else loadSessions(true);
    };
    (0, import_react.useEffect)(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, [msgs, streaming]);
    (0, import_react.useEffect)(() => {
      if (!modelSel && cfg?.models?.length) {
        const m = cfg.activeModel && cfg.models.includes(cfg.activeModel) ? cfg.activeModel : cfg.models[0];
        setModelSel(m);
        try {
          localStorage.setItem("pwb_ai_model", m);
        } catch {
        }
      }
    }, [cfg, modelSel]);
    (0, import_react.useEffect)(() => {
      if (!aiCtx) return;
      const s = { id: aiUid(), title: aiCtx.name, asset: { ...aiCtx }, msgs: [], updated: Date.now(), created: Date.now() };
      const list = sessionsRef.current;
      setSessions([...list, s]);
      setActiveId(s.id);
      try {
        localStorage.setItem("pwb_ai_active", s.id);
      } catch {
      }
      saveSession(s);
    }, [aiCtx]);
    (0, import_react.useEffect)(() => {
      if (activeId || !sessions.length) return;
      const latest = [...sessions].sort((a, b) => b.updated - a.updated)[0];
      if (latest) setActiveId(latest.id);
    }, [sessions, activeId]);
    const toolLabel = (name) => TOOL_LABELS[name] ? t(TOOL_LABELS[name]) : name;
    const saveCfg = async () => {
      try {
        const d = await api("/ai/config", { method: "PUT", body: JSON.stringify(cfgForm) });
        setCfg(d);
        setCfgOpen(false);
        toast(t("ai_cfg_saved"));
      } catch (e) {
        toast(e.message, true);
      }
    };
    const runTest = async () => {
      setTestState({ ok: null, text: t("ai_testing") });
      try {
        const d = await api("/ai/test", { method: "POST", body: JSON.stringify({ ...cfgForm, model: modelSel }) });
        setTestState(d.ok ? { ok: true, text: t("ai_test_ok", { ms: d.ms }) + (d.reply ? " \xB7 " + d.reply : "") } : { ok: false, text: t("ai_test_fail") + " " + (d.error ?? "") });
      } catch (e) {
        setTestState({ ok: false, text: e.message });
      }
    };
    const openCfg = () => {
      setCfgForm({
        provider: cfg?.provider ?? "deepseek",
        mode: cfg?.mode ?? "openai",
        baseURL: cfg?.baseURL ?? "",
        key: "",
        models: cfg?.models ?? [],
        activeModel: cfg?.activeModel ?? "",
        hasKey: cfg?.hasKey ?? false
      });
      setTestState(null);
      setCfgOpen(true);
    };
    const pickProvider = (id) => {
      const p = (cfg?.providers ?? []).find((x) => x.id === id);
      setCfgForm((f) => ({
        ...f,
        provider: id,
        mode: p?.mode ?? f.mode,
        baseURL: p?.baseURL ?? "",
        models: p?.models ?? [],
        activeModel: p?.models?.[0] ?? "",
        key: f.key
      }));
    };
    const newSession = () => {
      if (streaming) return;
      const s = { id: aiUid(), title: t("ai_new_chat"), msgs: [], updated: Date.now(), created: Date.now() };
      persist([...sessionsRef.current, s], s.id);
      saveSession(s);
    };
    const delSession = async (id) => {
      const s = sessionsRef.current.find((x) => x.id === id);
      const ok = await ask.confirm({ title: t("ai_del_session"), danger: true, okText: t("ok_del"), message: t("ai_del_session_msg", { name: s?.title ?? "" }) });
      if (!ok) return;
      try {
        await api(`/ai/sessions/${id}`, { method: "DELETE" });
      } catch (e) {
        toast(e.message, true);
        return;
      }
      const next = sessionsRef.current.filter((x) => x.id !== id);
      const fallback = next.sort((a, b) => b.updated - a.updated)[0];
      persist(next, fallback ? fallback.id : null);
    };
    const answerConfirm = async (id, approved) => {
      try {
        await api("/ai/confirm", { method: "POST", body: JSON.stringify({ id, approved }) });
      } catch (e) {
        toast(e.message, true);
        return;
      }
      setSessions((list) => list.map((x) => x.id === activeId ? { ...x, msgs: x.msgs.map((m) => m.confirm && m.confirm.id === id ? { ...m, confirm: { ...m.confirm, state: approved ? "approved" : "rejected" } } : m) } : x));
    };
    const send = async () => {
      const text = input.trim();
      if (!text || streaming) return;
      if (!cfg?.hasKey) {
        openCfg();
        return;
      }
      let sid = activeId;
      if (!sid || !sessionsRef.current.some((x) => x.id === sid)) {
        const s = { id: aiUid(), title: text.slice(0, 24), msgs: [], updated: Date.now() };
        setSessions([...sessionsRef.current, s]);
        sid = s.id;
        setActiveId(s.id);
      }
      const userMsg = { role: "user", content: text };
      const placeholder = { role: "assistant", content: "", streaming: true };
      setSessions((list) => list.map((x) => x.id === sid ? { ...x, msgs: [...x.msgs, userMsg, placeholder], title: x.msgs.length ? x.title : text.slice(0, 24), updated: Date.now() } : x));
      setInput("");
      requestAnimationFrame(() => {
        const el = taRef.current;
        if (el) el.style.height = "auto";
      });
      setStreaming(true);
      try {
        const res = await fetch(API + "/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [...historyOf(sid), userMsg], asset: active?.asset ?? void 0, model: modelSel ?? void 0 }) });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (; ; ) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            let ev;
            try {
              ev = JSON.parse(line.slice(5));
            } catch {
              continue;
            }
            setSessions((list) => list.map((x) => x.id === sid ? { ...x, msgs: applyEv(x.msgs, ev), updated: Date.now() } : x));
            if (ev.type === "confirm") {
              fetch(API + "/ai/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: ev.id, approved: true }) }).catch(() => {
              });
            }
          }
        }
      } catch (e) {
        setSessions((list) => list.map((x) => x.id === sid ? { ...x, msgs: applyEv(x.msgs, { type: "error", error: String(e.message ?? e) }) } : x));
      } finally {
        setStreaming(false);
        const cur = sessionsRef.current.find((x) => x.id === sid);
        if (cur) saveSession(cur);
      }
    };
    const historyOf = (sid) => sessionsRef.current.find((x) => x.id === sid)?.msgs ?? [];
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ai-layout", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ai-side", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "primary ai-new", onClick: newSession, disabled: streaming, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "plus", size: 14 }),
          t("ai_new_chat")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { padding: "0 2px 4px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "chip" + (!archView ? " on" : ""), style: { margin: 0 }, onClick: () => setArchView(false), children: t("ai_sessions_view") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "chip" + (archView ? " on" : ""), style: { margin: 0 }, onClick: () => setArchView(true), children: t("ai_archived_view") })
        ] }),
        sessions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ai-sessions", children: [...sessions].sort((a, b) => b.updated - a.updated).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            className: "ai-session" + (s.id === activeId && !archView ? " on" : ""),
            onClick: () => {
              if (archView) return;
              setActiveId(s.id);
              try {
                localStorage.setItem("pwb_ai_active", s.id);
              } catch {
              }
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ai-session-title", children: [
                s.asset ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "server", size: 12 }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "edit", size: 12 }),
                esc(s.title)
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ai-session-meta", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: relTime(s.updated) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "button",
                  {
                    className: "ibtn sm",
                    title: archView ? t("ai_unarchive") : t("ai_archive"),
                    onClick: (ev) => {
                      ev.stopPropagation();
                      archiveSession(s.id, archView);
                    },
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "archive", size: 11 })
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm red", title: t("ai_del_session"), onClick: (ev) => {
                  ev.stopPropagation();
                  delSession(s.id);
                }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "trash", size: 11 }) })
              ] })
            ]
          },
          s.id
        )) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "muted", style: { padding: "8px 4px" }, children: listLoaded ? archView ? t("ai_archived_view") : t("ai_no_sessions") : "\u2026" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ai-main", children: [
        active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { marginBottom: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { className: "ai-cur-title", children: esc(active.title) }),
          active.asset ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "badge", children: esc(active.asset.host ? active.asset.name + " \xB7 " + active.asset.host : active.asset.name) }) : null
        ] }) }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ai-msgs", ref: scrollRef, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ai-msgs-inner", children: msgs.length ? msgs.map((m, mi) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ai-msg " + m.role, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ai-avatar", children: m.role === "user" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "dot", size: 12 }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "flame", size: 14 }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ai-bubble", children: [
            (m.tools ?? []).length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ai-tools", children: m.tools.map((tl, ti) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ai-tool" + (tl.done ? " done" : ""), children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: tl.done ? "check" : "refresh", size: 11 }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
                toolLabel(tl.name),
                tl.done ? " \u2713" : "\u2026"
              ] })
            ] }, ti)) }) : null,
            m.role === "assistant" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ai-md", dangerouslySetInnerHTML: { __html: mdLite(m.content || (m.streaming ? "\u2026" : "")) } }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ai-utext", children: esc(m.content) }),
            m.confirm ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ai-confirm", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ai-confirm-title", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "alert", size: 13 }),
                t("confirm_title")
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ai-confirm-body", children: esc(m.confirm.summary) }),
              m.confirm.state === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { justifyContent: "flex-end", gap: 6, marginTop: 8 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "mini", onClick: () => answerConfirm(m.confirm.id, false), children: t("confirm_reject") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "mini primary", onClick: () => answerConfirm(m.confirm.id, true), children: t("confirm_approve") })
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "muted", style: { marginTop: 6 }, children: m.confirm.state === "approved" ? "\u2713 \u5DF2\u6279\u51C6" : "\u2715 \u5DF2\u62D2\u7EDD" })
            ] }) : null,
            m.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ai-err", children: esc(m.error) }) : null
          ] }),
          m.streaming && m.role === "assistant" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "ai-cursor" }) : null
        ] }, mi)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "flame", text: t("ai_welcome") }) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ai-input", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ai-input-box", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "textarea",
            {
              ref: taRef,
              rows: 3,
              className: "ai-ta",
              placeholder: cfg && !cfg.hasKey ? t("ai_need_cfg_first") : t("ai_ph"),
              value: input,
              disabled: streaming,
              onChange: (e) => {
                setInput(e.target.value);
                autoGrowTa();
              },
              onKeyDown: (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ai-input-actions", children: [
            providerName ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", style: { marginRight: 2, whiteSpace: "nowrap" }, title: t("ai_provider"), children: esc(providerName) }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "select",
              {
                className: "ai-model-sel",
                value: modelSel,
                title: t("ai_model"),
                onChange: (e) => {
                  setModelSel(e.target.value);
                  try {
                    localStorage.setItem("pwb_ai_model", e.target.value);
                  } catch {
                  }
                },
                children: [
                  (cfg?.models ?? []).map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: m, children: esc(m) }, m)),
                  modelSel && !(cfg?.models ?? []).includes(modelSel) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: modelSel, children: esc(modelSel) }) : null
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm", title: t("ai_config"), onClick: openCfg, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "sliders", size: 14 }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "primary ai-send", title: t("ai_send"), disabled: streaming || !input.trim(), onClick: send, children: t("ai_send") })
          ] })
        ] }) })
      ] }),
      cfgOpen && cfgForm ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Modal, { title: t("ai_config"), wide: true, onClose: () => setCfgOpen(false), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("ai_provider") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: cfgForm.provider, onChange: (e) => pickProvider(e.target.value), children: (cfg?.providers ?? []).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: p.id, children: esc(p.name) }, p.id)) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("ai_mode") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { value: cfgForm.mode, onChange: (e) => setCfgForm({ ...cfgForm, mode: e.target.value }), children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "openai", children: "OpenAI \u517C\u5BB9" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "anthropic", children: "Claude \u539F\u751F" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("ai_baseurl") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: cfgForm.baseURL, placeholder: "https://\u2026", onChange: (e) => setCfgForm({ ...cfgForm, baseURL: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("ai_key") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "password", placeholder: cfgForm.hasKey ? t("ai_key_keep") : "", value: cfgForm.key, onChange: (e) => setCfgForm({ ...cfgForm, key: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("ai_models") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ai-models-edit", children: [
            cfgForm.models.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "ai-model-chip", children: [
              esc(m),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn sm", title: t("del"), onClick: () => setCfgForm({ ...cfgForm, models: cfgForm.models.filter((x) => x !== m) }), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "x", size: 10 }) })
            ] }, m)),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                className: "ai-model-add",
                placeholder: t("ai_model_ph"),
                value: cfgForm.newModel ?? "",
                onChange: (e) => setCfgForm({ ...cfgForm, newModel: e.target.value }),
                onKeyDown: (e) => {
                  if (e.key === "Enter" && e.target.value.trim()) {
                    const v = e.target.value.trim();
                    if (!cfgForm.models.includes(v)) setCfgForm({ ...cfgForm, models: [...cfgForm.models, v], newModel: "" });
                    e.target.value = "";
                  }
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "mini", onClick: () => {
              const v = (cfgForm.newModel ?? "").trim();
              if (v && !cfgForm.models.includes(v)) setCfgForm({ ...cfgForm, models: [...cfgForm.models, v], newModel: "" });
            }, children: t("add_model") })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { justifyContent: "space-between", marginTop: 4 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "mini", onClick: runTest, disabled: !cfgForm.baseURL || !cfgForm.key || !cfgForm.models.length, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "refresh", size: 12 }),
            t("ai_test")
          ] }),
          testState ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", style: { color: testState.ok === false ? "var(--pwb-bad-fg)" : testState.ok ? "var(--pwb-ok-fg)" : "var(--pwb-muted)" }, children: esc(testState.text ?? "") }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { justifyContent: "flex-end", marginTop: 12 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setCfgOpen(false), children: t("cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "primary", onClick: saveCfg, children: t("save") })
        ] })
      ] }) : null
    ] });
  }
  var TABS = [
    { id: "apps", labelKey: "tab_apps", icon: "rocket" },
    { id: "todo", labelKey: "tab_todo", icon: "checkCircle" },
    { id: "nav", labelKey: "tab_nav", icon: "compass" },
    { id: "assets", labelKey: "tab_assets", icon: "server" },
    { id: "note", labelKey: "tab_note", icon: "edit" },
    { id: "keys", labelKey: "tab_keys", icon: "lock" },
    { id: "ai", labelKey: "tab_ai", icon: "flame" }
  ];
  function WorkbenchPanel() {
    const [tab, setTab] = (0, import_react.useState)(() => {
      try {
        const fromUrl = new URLSearchParams(location.search).get("tab");
        return localStorage.getItem("pwb_tab") || (fromUrl && ["apps", "todo", "nav", "assets", "note", "keys", "ai"].includes(fromUrl) ? fromUrl : "apps");
      } catch {
        return "apps";
      }
    });
    const [toast, setToast] = (0, import_react.useState)(null);
    const [dlg, setDlg] = (0, import_react.useState)(null);
    const [pref, setPref] = (0, import_react.useState)(false);
    const { mode, dark, set } = useTheme();
    const [accent, setAccent] = (0, import_react.useState)(() => {
      try {
        return localStorage.getItem("pwb_accent") === "pink" ? "pink" : "blue";
      } catch {
        return "blue";
      }
    });
    const [lang, setLang] = (0, import_react.useState)(() => {
      try {
        return localStorage.getItem("pwb_lang") === "en" ? "en" : "zh";
      } catch {
        return "zh";
      }
    });
    const t = (0, import_react.useMemo)(() => makeT(lang), [lang]);
    (0, import_react.useEffect)(() => {
      document.title = t("app_name");
    }, [t]);
    const show = (0, import_react.useCallback)((msg, err) => {
      setToast({ msg, err });
      setTimeout(() => setToast(null), err ? 4200 : 2200);
    }, []);
    const [autostart, setAutostart] = (0, import_react.useState)(null);
    (0, import_react.useEffect)(() => {
      api("/autostart").then((d) => setAutostart(d)).catch(() => setAutostart({ supported: false }));
    }, []);
    const toggleAutostart = async (on) => {
      try {
        setAutostart(await api("/autostart", { method: "PUT", body: JSON.stringify({ enabled: on }) }));
      } catch (e) {
        show(e.message, true);
      }
    };
    const [connLost, setConnLost] = (0, import_react.useState)(false);
    const connFails = (0, import_react.useRef)(0);
    (0, import_react.useEffect)(() => {
      let alive = true;
      let timer = null;
      const ping = async () => {
        if (!alive) return;
        try {
          const r = await fetch(API + "/health", { signal: AbortSignal.timeout(3e3) });
          if (!r.ok) throw new Error("bad status");
          const recovered = connFails.current >= 2;
          connFails.current = 0;
          if (recovered) {
            setConnLost(false);
            show(t("conn_restored"));
            setTimeout(() => {
              if (alive) location.reload();
            }, 900);
            return;
          }
          timer = setTimeout(ping, 8e3);
        } catch {
          connFails.current++;
          if (connFails.current >= 2) setConnLost(true);
          timer = setTimeout(ping, 3e3);
        }
      };
      timer = setTimeout(ping, 8e3);
      return () => {
        alive = false;
        clearTimeout(timer);
      };
    }, [t, show]);
    const go = (next) => {
      setTab(next);
      try {
        localStorage.setItem("pwb_tab", next);
      } catch {
      }
    };
    const ask = (0, import_react.useMemo)(() => ({
      confirm: (o) => new Promise((res) => setDlg({ kind: "confirm", id: rid(), ...o, resolve: res })),
      prompt: (o) => new Promise((res) => setDlg({ kind: "prompt", id: rid(), ...o, resolve: res }))
    }), []);
    const closeDlg = (0, import_react.useCallback)((v) => {
      setDlg((d) => {
        if (d) d.resolve(v);
        return null;
      });
    }, []);
    const pickAccent = (a) => {
      setAccent(a);
      try {
        localStorage.setItem("pwb_accent", a);
      } catch {
      }
    };
    const pickLang = (l) => {
      setLang(l);
      try {
        localStorage.setItem("pwb_lang", l);
      } catch {
      }
    };
    const [aiCtx, setAiCtx] = (0, import_react.useState)(null);
    const openAssetChat = (a) => {
      setAiCtx({ name: a.name, host: a.host, port: a.port, grp: a.grp, note: a.note, status: a.last_status || "\u672A\u68C0" });
      go("ai");
    };
    const cls = "pwb" + (dark ? " pwb-dark" : "") + (accent === "pink" ? " pwb-pink" : "") + (tab === "ai" ? " ai-page" : "");
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cls, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: CSS2 }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-topbar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-brand", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, {}),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: t("app_name") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pwb-seg", role: "tablist", children: TABS.map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            role: "tab",
            "aria-selected": tab === x.id,
            title: t(x.labelKey),
            className: "pwb-seg-item" + (tab === x.id ? " on" : ""),
            onClick: () => go(x.id),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: x.icon, size: 15 }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t(x.labelKey) })
            ]
          },
          x.id
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "spacer" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "ibtn" + (pref ? " on" : ""), title: t("appearance"), onClick: () => setPref((v) => !v), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "sliders", size: 16 }) }),
        pref ? (0, import_react_dom.createPortal)(
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pwb-pop-overlay", onMouseDown: () => setTimeout(() => setPref(false), 0) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-pop", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-pop-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pwb-pop-title", children: t("appearance") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pwb-seg mini", style: { display: "flex" }, children: [["auto", t("auto"), "contrast"], ["light", t("light"), "sun"], ["dark", t("dark"), "moon"]].map(([m, label, ic]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { style: { flex: 1 }, className: "pwb-seg-item" + (mode === m ? " on" : ""), onClick: () => set(m), children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: ic, size: 12 }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label })
                ] }, m)) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-pop-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pwb-pop-title", children: t("theme_color") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-swatches", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "pwb-swatch" + (accent === "blue" ? " on" : ""), onClick: () => pickAccent("blue"), children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { background: "linear-gradient(135deg,#4da3ff,#0053b8)" } }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("blue") }),
                    accent === "blue" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "check", size: 13 }) : null
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "pwb-swatch" + (accent === "pink" ? " on" : ""), onClick: () => pickAccent("pink"), children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { background: "linear-gradient(135deg,#ff8ab5,#cc3572)" } }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("pink") }),
                    accent === "pink" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "check", size: 13 }) : null
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-pop-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pwb-pop-title", children: t("language") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pwb-seg mini", style: { display: "flex" }, children: [["zh", "\u4E2D\u6587"], ["en", "English"]].map(([l, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: { flex: 1 }, className: "pwb-seg-item" + (lang === l ? " on" : ""), onClick: () => pickLang(l), children: label }, l)) })
              ] }),
              autostart?.supported !== false ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pwb-pop-row", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "row", style: { justifyContent: "space-between", gap: 8 }, title: t("autostart_tip"), children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "muted", style: { fontSize: 12.5, whiteSpace: "nowrap" }, children: t("autostart") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, { on: !!autostart?.enabled, onChange: toggleAutostart })
              ] }) }) : null
            ] })
          ] }),
          portalTarget()
        ) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pwb-body", children: tab === "apps" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppsPane, { toast: show, ask, t }) : tab === "todo" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TodoPane, { toast: show, ask, t, lang }) : tab === "nav" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavPane, { toast: show, ask, t }) : tab === "assets" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetsPane, { toast: show, ask, t, onAiChat: openAssetChat }) : tab === "note" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NotesPane, { toast: show, t, lang }) : tab === "keys" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeysPane, { toast: show, ask, t }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AIPane, { toast: show, ask, t, lang, aiCtx, onClearCtx: () => setAiCtx(null) }) }, tab),
      connLost ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-conn", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "refresh", size: 13 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("conn_lost") })
      ] }) : null,
      toast ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pwb-toast" + (toast.err ? " err" : ""), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: toast.err ? "alert" : "checkCircle", size: 15 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: esc(toast.msg) })
      ] }) : null,
      dlg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, { dlg, onDone: closeDlg, t }, dlg.id) : null
    ] });
  }

  // src/standalone.jsx
  var import_jsx_runtime2 = __toESM(require_jsx_runtime(), 1);
  (0, import_client.createRoot)(document.getElementById("root")).render(/* @__PURE__ */ (0, import_jsx_runtime2.jsx)(WorkbenchPanel, {}));
})();
