module.exports = (request, options) => {
  // Si c'est un import relatif avec extension .js, le transformer vers .ts
  if (request.startsWith('./') || request.startsWith('../')) {
    if (request.endsWith('.js')) {
      const tsRequest = request.replace(/\.js$/, '.ts');
      try {
        return options.defaultResolver(tsRequest, options);
      } catch (err) {
        // Si le .ts n'existe pas, essayer le .js original
        return options.defaultResolver(request, options);
      }
    }
  }
  
  // Pour tous les autres cas, utiliser le resolver par défaut
  return options.defaultResolver(request, options);
}; 