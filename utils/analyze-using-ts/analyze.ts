#!/usr/bin/env node
import { Project, Node, SyntaxKind, ClassDeclaration, Scope, VariableDeclaration } from "ts-morph";
import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";


const program = new Command();

program
    .name("ts-dep-tree")
    .description("Анализатор зависимостей: внешние, внутренние и мертвый код")
    .requiredOption("-p, --project <path>", "Путь к tsconfig.json")
    .requiredOption("-t, --target <path>", "Путь к анализируемому файлу")
    .option("-j, --json", "Вывод в формате JSON", false)
    .parse(process.argv);

const options = program.opts();



function getCallerName(node: Node): string {
    const parent = node.getFirstAncestor(ancestor =>
        Node.isFunctionDeclaration(ancestor) ||
        Node.isMethodDeclaration(ancestor) ||
        Node.isArrowFunction(ancestor) ||
        Node.isClassDeclaration(ancestor) ||
        Node.isSourceFile(ancestor)
    );

    if (!parent) return "Unknown";

    if (Node.isFunctionDeclaration(parent) || Node.isMethodDeclaration(parent)) {
        return parent.getName() || "<Anonymous Function>";
    }

    if (Node.isClassDeclaration(parent)) {
        const prop = node.getFirstAncestorByKind(SyntaxKind.PropertyDeclaration);
        if (prop) return `Class Field: ${prop.getName()}`;
        return `Class: ${parent.getName()}`;
    }

    if (Node.isArrowFunction(parent)) {
        const variableDecl = parent.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
        return variableDecl ? variableDecl.getName() : "<Anonymous Arrow Function>";
    }

    if (Node.isSourceFile(parent)) {
        return "<Top Level / Global Scope>";
    }

    return "Unknown Scope";
}

async function main() {
    const tsConfigPath = path.resolve(process.cwd(), options.project);
    const targetFilePath = path.resolve(process.cwd(), options.target);

    if (!fs.existsSync(tsConfigPath)) {
        console.error(`❌ Ошибка: tsconfig не найден: ${tsConfigPath}`);
        process.exit(1);
    }
    if (!fs.existsSync(targetFilePath)) {
        console.error(`❌ Ошибка: Целевой файл не найден: ${targetFilePath}`);
        process.exit(1);
    }

    const project = new Project({ tsConfigFilePath: tsConfigPath });
    const sourceFile = project.getSourceFile(targetFilePath);

    if (!sourceFile) {
        console.error("❌ Ошибка: Файл не найден в проекте (проверьте 'include' в tsconfig).");
        process.exit(1);
    }

    if (!options.json) {
        console.log(`🎯 Target: ${sourceFile.getBaseName()}`);
    }

    
    const usedExternally: Record<string, Record<string, string[]>> = {};
    const usedInternallyOnly: string[] = [];
    const unusedTotal: string[] = [];
    const analyzedSymbols = new Set<string>(); 

    
    const analyzeNode = (name: string, node: Node) => {
        if (analyzedSymbols.has(name) || !Node.isReferenceFindable(node)) return;
        analyzedSymbols.add(name);

        const references = node.findReferencesAsNodes();

        let hasExternal = false;
        let hasInternal = false;

        references.forEach((ref: Node) => {
            
            if (ref.getStart() === node.getStart()) return;
            
            if (ref.getParent() === node || node.getParent() === ref) return;

            const refSourceFile = ref.getSourceFile();

            if (refSourceFile === sourceFile) {
                hasInternal = true;
            } else {
                hasExternal = true;
                const filePath = path.relative(path.dirname(tsConfigPath), refSourceFile.getFilePath());
                const callerName = getCallerName(ref);

                if (!usedExternally[name]) usedExternally[name] = {};
                if (!usedExternally[name][filePath]) usedExternally[name][filePath] = [];
                if (!usedExternally[name][filePath].includes(callerName)) {
                    usedExternally[name][filePath].push(callerName);
                }
            }
        });

        if (hasExternal) {
            
        } else if (hasInternal) {
            usedInternallyOnly.push(name);
        } else {
            unusedTotal.push(name);
        }
    };

    const exportedDeclarations = sourceFile.getExportedDeclarations();

    for (const [name, decls] of exportedDeclarations) {
        const mainDecl = decls[0];

        analyzeNode(name, mainDecl);

        let classDecl: ClassDeclaration | undefined = undefined;

        if (Node.isClassDeclaration(mainDecl)) {
            classDecl = mainDecl;
        } else if (Node.isVariableDeclaration(mainDecl)) {
            const type = mainDecl.getType();
            const symbol = type.getSymbol();
            if (symbol) {
                const decl = symbol.getDeclarations()[0];
                if (decl && Node.isClassDeclaration(decl)) {
                    classDecl = decl;
                }
            }
        }

        if (classDecl) {
            const baseName = classDecl.getName() === name ? name : `${name} (Class ${classDecl.getName()})`;

            
            classDecl.getInstanceMethods().forEach(member => {
                if (member.getScope() !== Scope.Private) {
                    const memberName = member.getName();
                    if (!memberName) return;
                    const fullName = `${name}.${memberName}()`;
                    analyzeNode(fullName, member);
                }
            });

            
            classDecl.getInstanceProperties().forEach(member => {
                
                
                if (member.getScope() !== Scope.Private) {
                    const memberName = member.getName();
                    if (!memberName) return;
                    const fullName = `${name}.${memberName}`;
                    analyzeNode(fullName, member);
                }
            });
        }
    }

    

    if (options.json) {
        console.log(JSON.stringify({
            external: usedExternally,
            internalOnly: usedInternallyOnly,
            unused: unusedTotal
        }, null, 2));
    } else {
        if (Object.keys(usedExternally).length > 0) {
            console.log("\n✅ USED EXTERNALLY (Используются другими файлами):");
            console.log("==================================================");
            for (const [symbol, files] of Object.entries(usedExternally)) {
                console.log(`\n🔹 ${symbol}`);
                for (const [file, callers] of Object.entries(files)) {
                    console.log(`   📄 ${file}`);
                    callers.forEach(caller => {
                        console.log(`      └─ ⚙️  ${caller}`);
                    });
                }
            }
        } else {
            console.log("\n📭 Внешних зависимостей не найдено.");
        }

        if (usedInternallyOnly.length > 0) {
            console.log("\n\n⚠️  USED INTERNALLY ONLY (Экспортировано, но используется только здесь):");
            console.log("   (Рекомендация: убрать 'export' или сделать 'private')");
            console.log("========================================================================");
            usedInternallyOnly.forEach(item => {
                console.log(`🔸 ${item}`);
            });
        }

        if (unusedTotal.length > 0) {
            console.log("\n\n💀 DEAD CODE (Не используется нигде):");
            console.log("=====================================");
            unusedTotal.forEach(item => {
                console.log(`🔴 ${item}`);
            });
        } else if (Object.keys(usedExternally).length > 0 || usedInternallyOnly.length > 0) {
            console.log("\n\n✨ Мёртвого кода (полностью неиспользуемого) не найдено.");
        }
        console.log("");
    }
}

main().catch(err => {
    console.error("Критическая ошибка:", err);
    process.exit(1);
});