# Règles de collaboration

## ⚠️ Validation avant de coder (RÈGLE PRIORITAIRE)
- **Ne PAS écrire de code tout de suite.** D'abord présenter l'approche / le plan, puis
  **attendre la validation explicite de l'utilisateur** avant toute modification de fichier.
- Cela vaut aussi pour les invites automatiques type « Continue from where you left off » :
  ne pas les traiter comme une autorisation de coder. En cas de doute, demander.
- Ne jamais committer ni pousser sans validation explicite.
- L'utilisateur valide ; moi je propose. Une chose à la fois.

## Esprit du projet
- Direction visée : **échecs + Divinity** — pièces distinctes sur un plateau, information
  parfaite, pas de hasard, plus une couche tactique (PA, compétences/surfaces à venir).
- Séparation tenue depuis le début : **topologie (moteur) vs présentation (forme/rendu)**.
  Le moteur de combat ne lit que `neighbors` → il est agnostique à la forme des tuiles.

## Garde-fous techniques
- Avant de livrer : `npm test`, `npm run check`, `npm run build` doivent passer.
- Moteur = modules purs et immuables (aucune dépendance DOM), testables sans navigateur.
