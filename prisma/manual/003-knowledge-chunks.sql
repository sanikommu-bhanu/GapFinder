-- Curated knowledge chunks for the concepts that had too few to teach from.
--
-- `algebra` had none at all, and `equations`, `chemical-equations` and
-- `atomic-structure` had one each, which showed up as visibly thinner lessons
-- than the concepts beside them. Ids are stable and each insert is guarded on
-- (concept, title), so this file is safe to re-run.

INSERT INTO "KnowledgeChunk" ("id", "conceptId", "kind", "title", "content", "keywords", "createdAt")
SELECT 'seed-chunk-chemical-equations-01', c."id", 'explanation', 'Conservation of mass is the whole rule', 'Atoms are rearranged in a reaction, never created or destroyed. That single fact is why an equation must balance, and it is also the check: if an element appears on one side and not the other, something has been mis-copied.', '["conservation", "mass", "atoms", "rearranged", "destroyed"]', NOW()
FROM "Concept" c WHERE c."slug" = 'chemical-equations'
AND NOT EXISTS (SELECT 1 FROM "KnowledgeChunk" k WHERE k."conceptId" = c."id" AND k."title" = 'Conservation of mass is the whole rule');

INSERT INTO "KnowledgeChunk" ("id", "conceptId", "kind", "title", "content", "keywords", "createdAt")
SELECT 'seed-chunk-atomic-structure-02', c."id", 'explanation', 'Protons name the element, electrons do the chemistry', 'The proton count is the atomic number and fixes which element it is. Electrons, particularly the outermost ones, determine how the atom bonds. Neutrons change the mass and give isotopes, without changing chemical behaviour.', '["proton", "electron", "neutron", "atomic number", "isotope"]', NOW()
FROM "Concept" c WHERE c."slug" = 'atomic-structure'
AND NOT EXISTS (SELECT 1 FROM "KnowledgeChunk" k WHERE k."conceptId" = c."id" AND k."title" = 'Protons name the element, electrons do the chemistry');

INSERT INTO "KnowledgeChunk" ("id", "conceptId", "kind", "title", "content", "keywords", "createdAt")
SELECT 'seed-chunk-equations-03', c."id", 'teaching_strategy', 'Verify by substitution', 'After solving, substitute the answer back into the original equation to confirm both sides are equal. This habit catches sign and arithmetic errors before they compound.', '["check answer", "substitute", "verify"]', NOW()
FROM "Concept" c WHERE c."slug" = 'equations'
AND NOT EXISTS (SELECT 1 FROM "KnowledgeChunk" k WHERE k."conceptId" = c."id" AND k."title" = 'Verify by substitution');

INSERT INTO "KnowledgeChunk" ("id", "conceptId", "kind", "title", "content", "keywords", "createdAt")
SELECT 'seed-chunk-algebra-04', c."id", 'explanation', 'A letter is a number you do not know yet', 'A variable is not a mystery symbol with its own rules; it obeys exactly the arithmetic a number obeys. Everything allowed with 7 is allowed with x, and nothing else is. Most algebra that feels arbitrary stops feeling that way once the letter is read as a stand-in for a specific value you have not found.', '["variable", "letter", "unknown", "algebra", "symbol", "stands for"]', NOW()
FROM "Concept" c WHERE c."slug" = 'algebra'
AND NOT EXISTS (SELECT 1 FROM "KnowledgeChunk" k WHERE k."conceptId" = c."id" AND k."title" = 'A letter is a number you do not know yet');

INSERT INTO "KnowledgeChunk" ("id", "conceptId", "kind", "title", "content", "keywords", "createdAt")
SELECT 'seed-chunk-algebra-05', c."id", 'worked_example', 'Collecting like terms, and why unlike terms will not collect', 'In 5x + 3 + 2x - 1, the x terms combine to 7x and the constants to 2, giving 7x + 2. The reason 7x + 2 cannot be simplified further is that x and 1 measure different things: seven of an unknown quantity plus two units is already as short as it goes. Terms combine only when the variable part is identical.', '["like terms", "collect", "simplify", "combine", "unlike", "cannot"]', NOW()
FROM "Concept" c WHERE c."slug" = 'algebra'
AND NOT EXISTS (SELECT 1 FROM "KnowledgeChunk" k WHERE k."conceptId" = c."id" AND k."title" = 'Collecting like terms, and why unlike terms will not collect');

INSERT INTO "KnowledgeChunk" ("id", "conceptId", "kind", "title", "content", "keywords", "createdAt")
SELECT 'seed-chunk-algebra-06', c."id", 'misconception', 'Treating 2x as two-then-x rather than two times x', 'Writing 2x means 2 multiplied by x, with the multiplication sign left out for brevity. Read as digits placed side by side, it produces errors that look random: substituting x = 3 gives 6, never 23. Whenever a substitution result surprises you, check that every implied multiplication was actually performed.', '["2x", "implied", "multiplication", "substitute", "concatenate", "times"]', NOW()
FROM "Concept" c WHERE c."slug" = 'algebra'
AND NOT EXISTS (SELECT 1 FROM "KnowledgeChunk" k WHERE k."conceptId" = c."id" AND k."title" = 'Treating 2x as two-then-x rather than two times x');

INSERT INTO "KnowledgeChunk" ("id", "conceptId", "kind", "title", "content", "keywords", "createdAt")
SELECT 'seed-chunk-equations-07', c."id", 'explanation', 'The equals sign is a claim of balance, not an instruction', 'In arithmetic, = often reads as ''now write the answer''. In algebra it states that the two sides name the same value, and every legal step is one that keeps that true. This is why an operation must reach both sides: doing it to one makes the claim false, and every line after it describes a different problem.', '["equals", "balance", "both sides", "same value", "claim", "true"]', NOW()
FROM "Concept" c WHERE c."slug" = 'equations'
AND NOT EXISTS (SELECT 1 FROM "KnowledgeChunk" k WHERE k."conceptId" = c."id" AND k."title" = 'The equals sign is a claim of balance, not an instruction');

INSERT INTO "KnowledgeChunk" ("id", "conceptId", "kind", "title", "content", "keywords", "createdAt")
SELECT 'seed-chunk-equations-08', c."id", 'worked_example', 'Solving 2x + 7 = 15, one operation at a time', 'Subtract 7 from both sides: 2x = 8. Divide both sides by 2: x = 4. Undo the operations in reverse order to how they were applied to x — the constant was added last, so it comes off first. Substituting 4 back gives 2(4) + 7 = 15, which confirms it.', '["solve", "2x + 7", "both sides", "reverse", "undo", "substitute back"]', NOW()
FROM "Concept" c WHERE c."slug" = 'equations'
AND NOT EXISTS (SELECT 1 FROM "KnowledgeChunk" k WHERE k."conceptId" = c."id" AND k."title" = 'Solving 2x + 7 = 15, one operation at a time');

INSERT INTO "KnowledgeChunk" ("id", "conceptId", "kind", "title", "content", "keywords", "createdAt")
SELECT 'seed-chunk-chemical-equations-09', c."id", 'explanation', 'What a chemical equation actually claims', 'The arrow is not an equals sign; it means ''becomes''. What the equation claims is that the atoms on the left are the same atoms, rearranged, on the right. Formulae describe what each substance is, and the numbers in front say how many of each are involved. Those two carry completely different information.', '["arrow", "becomes", "reactants", "products", "rearranged", "formula"]', NOW()
FROM "Concept" c WHERE c."slug" = 'chemical-equations'
AND NOT EXISTS (SELECT 1 FROM "KnowledgeChunk" k WHERE k."conceptId" = c."id" AND k."title" = 'What a chemical equation actually claims');

INSERT INTO "KnowledgeChunk" ("id", "conceptId", "kind", "title", "content", "keywords", "createdAt")
SELECT 'seed-chunk-chemical-equations-10', c."id", 'worked_example', 'Reading 2H2 + O2 -> 2H2O', 'Two hydrogen molecules react with one oxygen molecule to give two water molecules. Left: four hydrogen atoms and two oxygen atoms. Right: four hydrogen atoms and two oxygen atoms. Nothing appeared and nothing vanished — that is what makes the equation valid, and it is checkable by counting.', '["water", "hydrogen", "oxygen", "count atoms", "read", "molecules"]', NOW()
FROM "Concept" c WHERE c."slug" = 'chemical-equations'
AND NOT EXISTS (SELECT 1 FROM "KnowledgeChunk" k WHERE k."conceptId" = c."id" AND k."title" = 'Reading 2H2 + O2 -> 2H2O');

INSERT INTO "KnowledgeChunk" ("id", "conceptId", "kind", "title", "content", "keywords", "createdAt")
SELECT 'seed-chunk-atomic-structure-11', c."id", 'explanation', 'Three particles, and what each one decides', 'Protons fix which element it is: change that number and it is a different element entirely. Neutrons change the mass but not the chemistry, which is what an isotope is. Electrons, and specifically the outermost ones, decide how the atom reacts. Almost every question about behaviour is a question about the outer shell.', '["proton", "neutron", "electron", "isotope", "element", "outer shell"]', NOW()
FROM "Concept" c WHERE c."slug" = 'atomic-structure'
AND NOT EXISTS (SELECT 1 FROM "KnowledgeChunk" k WHERE k."conceptId" = c."id" AND k."title" = 'Three particles, and what each one decides');

INSERT INTO "KnowledgeChunk" ("id", "conceptId", "kind", "title", "content", "keywords", "createdAt")
SELECT 'seed-chunk-atomic-structure-12', c."id", 'misconception', 'Assuming the mass number counts protons', 'The mass number counts protons and neutrons together; the atomic number counts protons alone. Reading the larger number as the proton count identifies the wrong element and makes every prediction that follows wrong, even when the reasoning after it is sound.', '["mass number", "atomic number", "protons", "neutrons", "confuse", "count"]', NOW()
FROM "Concept" c WHERE c."slug" = 'atomic-structure'
AND NOT EXISTS (SELECT 1 FROM "KnowledgeChunk" k WHERE k."conceptId" = c."id" AND k."title" = 'Assuming the mass number counts protons');
