/**
 * CLI-presentable error shape. Every service's error union has a
 * `present<Service>Error` function that converts its tagged variants to
 * this flat shape for stdout/stderr output. Keeping the output contract
 * a narrow interface (rather than a class) lets each service own its
 * own error union without coupling to a shared base class.
 */
export interface PresentedError {
  readonly code: string;
  readonly message: string;
}
