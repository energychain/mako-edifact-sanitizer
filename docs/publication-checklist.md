# Publication checklist

Before GitHub/NPM publication:

1. Human review of code and README safety wording.
2. Confirm package name and owner/scope.
3. Confirm license (current draft: MIT).
4. Run verification:
   - npm install
   - npm test
   - npm run smoke
   - npm pack --dry-run
5. Inspect npm pack file list for accidental secrets or real data.
6. Keep explicit language: pseudonymization aid, not guaranteed DSGVO anonymization and not legal advice.
7. Do not publish real or mixed-sensitive EDIFACT fixtures.
8. Decide whether the first public repository should live under energychain or another GitHub org.
9. NPM publish only after a separate explicit approval.
