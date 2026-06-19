// Resolve image/css imports to an inline empty JS module so data files load headlessly under tsx.
export function resolve(specifier, context, next) {
  if (/\.(png|jpe?g|svg|webp|css|gif)$/.test(specifier)) {
    return { url: "data:text/javascript,export%20default%20%22%22", shortCircuit: true };
  }
  return next(specifier, context);
}
