/**
 * Wrapper type constants
 */
type WrapperType = "WRAPPER" | "MIXED" | "OVERRIDE" | "LISTENER";

/**
 * Performance mode constants
 */
type PerformanceMode = "NORMAL" | "AUTO" | "FAST";

/**
 * Options for libWrapper.register
 */
interface LibWrapperRegisterOptions {
  /**
   * If 'true', the first parameter to 'fn' will be a function object that can be called to continue the chain.
   * This parameter must be 'true' when registering non-OVERRIDE wrappers.
   * Default is 'false' if type=='OVERRIDE', otherwise 'true'.
   * First introduced in v1.3.6.0.
   */
  chain?: boolean;

  /**
   * Selects the preferred performance mode for this wrapper. Default is 'AUTO'.
   * It will be used if all other wrappers registered on the same target also prefer the same mode, otherwise the default will be used instead.
   * This option should only be specified with good reason. In most cases, using 'AUTO' in order to allow the GM to choose is the best option.
   * First introduced in v1.5.0.0.
   */
  perf_mode?: PerformanceMode;

  /**
   * An array of parameters that should be passed to 'fn'.
   * This allows avoiding an extra function call.
   * First introduced in v1.12.0.0.
   */
  bind?: any[];
}

/**
 * Options for libWrapper.ignore_conflicts
 */
interface LibWrapperIgnoreConflictsOptions {
  /**
   * If 'true', will also ignore confirmed conflicts (i.e. errors), rather than only potential conflicts (i.e. warnings).
   * Be careful when setting this to 'true', as confirmed conflicts are almost certainly something the user should be made aware of.
   * Defaults to 'false'.
   */
  ignore_errors?: boolean;
}

/**
 * Base error class for libWrapper errors
 */
declare class LibWrapperError extends Error {
  ui_msg: string;
  console_msg: string;
  notification_verbosity: number;
  onUnhandled(): void;
}

/**
 * Internal libWrapper error
 */
declare class LibWrapperInternalError extends LibWrapperError {
  package_info?: any;
  package_id?: string;
}

/**
 * Error caused by a package
 */
declare class LibWrapperPackageError extends LibWrapperError {
  package_info?: any;
  package_id?: string;
}

/**
 * Error thrown when trying to register an OVERRIDE wrapper when one already exists
 */
declare class LibWrapperAlreadyOverriddenError extends LibWrapperError {
  package_info?: any;
  package_id?: string;
  conflicting_info?: any;
  conflicting_id?: string;
  /** @deprecated since v1.6.0.0 - use package_id instead */
  module?: string;
  /** @deprecated since v1.6.0.0 - use conflicting_id instead */
  conflicting_module?: string;
  target?: string | number;
  onUnhandled(): void;
}

/**
 * Error thrown when a wrapper chain is invalid
 */
declare class LibWrapperInvalidWrapperChainError extends LibWrapperPackageError {
  _wrapper?: any;
}

/**
 * Interface for the libWrapper static class
 */
interface LibWrapperStatic {
  /**
   * Get libWrapper version
   * @returns libWrapper version in string form, i.e. "<MAJOR>.<MINOR>.<PATCH>.<SUFFIX><META>"
   */
  readonly version: string;

  /**
   * Get libWrapper version
   * @returns libWrapper version in array form, i.e. [<MAJOR>, <MINOR>, <PATCH>, <SUFFIX>, <META>]
   */
  readonly versions: [number, number, number, number, string];

  /**
   * Get the Git version identifier.
   * @returns Git version identifier, usually 'HEAD' or the commit hash.
   */
  readonly git_version: string;

  /**
   * @returns The real libWrapper module will always return false. Fallback implementations (e.g. poly-fill / shim) should return true.
   */
  readonly is_fallback: boolean;

  // Error classes
  readonly LibWrapperError: typeof LibWrapperError;
  readonly Error: typeof LibWrapperError;
  readonly LibWrapperInternalError: typeof LibWrapperInternalError;
  readonly InternalError: typeof LibWrapperInternalError;
  readonly LibWrapperPackageError: typeof LibWrapperPackageError;
  readonly PackageError: typeof LibWrapperPackageError;
  readonly LibWrapperAlreadyOverriddenError: typeof LibWrapperAlreadyOverriddenError;
  readonly AlreadyOverriddenError: typeof LibWrapperAlreadyOverriddenError;
  readonly LibWrapperInvalidWrapperChainError: typeof LibWrapperInvalidWrapperChainError;
  readonly InvalidWrapperChainError: typeof LibWrapperInvalidWrapperChainError;

  // Wrapper type constants
  readonly WRAPPER: WrapperType;
  readonly MIXED: WrapperType;
  readonly OVERRIDE: WrapperType;
  readonly LISTENER: WrapperType;

  // Performance mode constants
  readonly PERF_NORMAL: PerformanceMode;
  readonly PERF_AUTO: PerformanceMode;
  readonly PERF_FAST: PerformanceMode;

  /**
   * Test for a minimum libWrapper version.
   * First introduced in v1.4.0.0.
   *
   * @param major Minimum major version
   * @param minor [Optional] Minimum minor version. Default is 0.
   * @param patch [Optional] Minimum patch version. Default is 0.
   * @param suffix [Optional] Minimum suffix version. Default is 0.
   * @returns Returns true if the libWrapper version is at least the queried version, otherwise false.
   */
  version_at_least(
    major: number,
    minor?: number,
    patch?: number,
    suffix?: number,
  ): boolean;

  /**
   * Register a new wrapper.
   * Important: If called before the 'init' hook, this method will fail.
   *
   * In addition to wrapping class methods, there is also support for wrapping methods on specific object instances, as well as class methods inherited from parent classes.
   * However, it is recommended to wrap methods directly in the class that defines them whenever possible, as inheritance/instance wrapping is less thoroughly tested and will incur a performance penalty.
   *
   * Triggers FVTT hook 'libWrapper.Register' when successful.
   *
   * Returns a unique numeric target identifier, which can be used as a replacement for 'target' in future calls to 'libWrapper.register' and 'libWrapper.unregister'.
   *
   * @param package_id The package identifier, i.e. the 'id' field in your module/system/world's manifest.
   *
   * @param target The target identifier, specifying which wrapper should be registered.
   *
   *   This can be either:
   *     1. A unique target identifier obtained from a previous 'libWrapper.register' call.
   *     2. A string containing the path to the function you wish to add the wrapper to, starting at global scope, for example 'SightLayer.prototype.updateToken'.
   *
   *   Support for the unique target identifiers (option #1) was added in v1.11.0.0, with previous versions only supporting option #2.
   *
   *   Since v1.8.0.0, the string path (option #2) can contain string array indexing.
   *   For example, 'CONFIG.Actor.sheetClasses.character["dnd5e.ActorSheet5eCharacter"].cls.prototype._onLongRest' is a valid path.
   *   It is important to note that indexing in libWrapper does not work exactly like in JavaScript:
   *     - The index must be a single string, quoted using the ' or " characters. It does not support e.g. numbers or objects.
   *     - A backslash \\ can be used to escape another character so that it loses its special meaning, e.g. quotes i.e. ' and " as well as the character \\ itself.
   *
   *   By default, libWrapper searches for normal methods or property getters only. To wrap a property's setter, append '#set' to the name, for example 'SightLayer.prototype.blurDistance#set'.
   *
   * @param fn Wrapper function. The first argument will be the next function in the chain, except for 'OVERRIDE' wrappers.
   *           The remaining arguments will correspond to the parameters passed to the wrapped method.
   *
   * @param type [Optional] The type of the wrapper. Default is 'MIXED'.
   *
   *   The possible types are:
   *
   *   'LISTENER' / libWrapper.LISTENER:
   * 	   Use this to register a listener function. This function will be called immediately before the target is called, but is not part of the call chain.
   *     Use when you just need to know a method is being called and the parameters used for the call, without needing to modify the parameters or execute any
   *     code after the method finishes execution.
   *     Listeners will always be called first, before any other type, and should be used whenever possible as they have a virtually zero chance of conflict.
   *     Note that asynchronous listeners are *not* awaited before execution is allowed to proceed.
   *     First introduced in v1.13.0.0.
   *
   *   'WRAPPER' / libWrapper.WRAPPER:
   *     Use if your wrapper will *always* continue the chain.
   *     This type has priority over MIXED and OVERRIDE. It should be preferred over those whenever possible as it massively reduces the likelihood of conflicts.
   *     Note that the library will auto-detect if you use this type but do not call the original function, and automatically unregister your wrapper.
   *
   *   'MIXED' / libWrapper.MIXED:
   *     Default type. Your wrapper will be allowed to decide whether it continue the chain or not.
   *     These will always come after 'WRAPPER'-type wrappers. Order is not guaranteed, but conflicts will be auto-detected.
   *
   *   'OVERRIDE' / libWrapper.OVERRIDE:
   *     Use if your wrapper will *never* continue the chain. This type has the lowest priority, and will always be called last.
   *     If another package already has an 'OVERRIDE' wrapper registered to the same method, using this type will throw a <libWrapper.ERRORS.package> exception.
   *     Catching this exception should allow you to fail gracefully, and for example warn the user of the conflict.
   *     Note that if the GM has explicitly given your package priority over the existing one, no exception will be thrown and your wrapper will take over.
   *
   * @param options [Optional] Additional options to libWrapper.
   *
   * @returns Unique numeric 'target' identifier which can be used in future 'libWrapper.register' and 'libWrapper.unregister' calls.
   *   Added in v1.11.0.0.
   */
  register(
    package_id: string,
    target: number | string,
    fn: (wrapped: (...args: any[]) => any, ...args: any[]) => any,
    type?: WrapperType,
    options?: LibWrapperRegisterOptions,
  ): number;

  /**
   * Unregister an existing wrapper.
   *
   * Triggers FVTT hook 'libWrapper.Unregister' when successful.
   *
   * @param package_id The package identifier, i.e. the 'id' field in your module/system/world's manifest.
   *
   * @param target The target identifier, specifying which wrapper should be unregistered.
   *
   *   This can be either:
   *     1. A unique target identifier obtained from a previous 'libWrapper.register' call. This is the recommended option.
   *     2. A string containing the path to the function you wish to remove the wrapper from, starting at global scope, with the same syntax as the 'target' parameter to 'libWrapper.register'.
   *
   *   Support for the unique target identifiers (option #1) was added in v1.11.0.0, with previous versions only supporting option #2.
   *   It is recommended to use option #1 if possible, in order to guard against the case where the class or object at the given path is no longer the same as when `libWrapper.register' was called.
   *
   * @param fail [Optional] If true, this method will throw an exception if it fails to find the method to unwrap. Default is 'true'.
   */
  unregister(package_id: string, target: number | string, fail?: boolean): void;

  /**
   * Unregister all wrappers created by a given package.
   *
   * Triggers FVTT hook 'libWrapper.UnregisterAll' when successful.
   *
   * @param package_id The package identifier, i.e. the 'id' field in your module/system/world's manifest.
   */
  unregister_all(package_id: string): void;

  /**
   * Ignore conflicts matching specific filters when detected, instead of warning the user.
   *
   * This can be used when there are conflict warnings that are known not to cause any issues, but are unable to be resolved.
   * Conflicts will be ignored if they involve both 'package_id' and one of 'ignore_ids', and relate to one of 'targets'.
   *
   * Note that the user can still see which detected conflicts were ignored, by toggling "Show ignored conflicts" in the "Conflicts" tab in the libWrapper settings.
   *
   * First introduced in v1.7.0.0.
   *
   * @param package_id The package identifier, i.e. the 'id' field in your module/system/world's manifest. This will be the package that owns this ignore entry.
   *
   * @param ignore_ids Other package ID(s) with which conflicts should be ignored.
   *
   * @param targets Target(s) for which conflicts should be ignored, corresponding to the 'target' parameter to 'libWrapper.register'.
   *   This method does not accept the unique target identifiers returned by 'libWrapper.register'.
   *
   * @param options [Optional] Additional options to libWrapper.
   */
  ignore_conflicts(
    package_id: string,
    ignore_ids: string | string[],
    targets: string | string[],
    options?: LibWrapperIgnoreConflictsOptions,
  ): void;
}

/**
 * Global libWrapper instance
 */
declare const libWrapper: LibWrapperStatic;
