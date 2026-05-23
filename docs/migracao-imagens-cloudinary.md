# Migracao de imagens para Cloudinary

## Decisao

Os produtos existentes que ainda guardam nomes de arquivos locais devem ser atualizados por re-upload manual no painel admin.

## Motivo

O repositorio tinha poucos arquivos versionados em `uploads/`, entao o custo de criar e validar um script de migracao com credenciais de banco e Cloudinary nao compensa neste momento. O re-upload manual tambem evita depender do filesystem local em producao.

## Como executar

1. Abrir o produto no painel admin.
2. Selecionar uma nova imagem nos formatos JPG, JPEG, PNG ou WEBP.
3. Salvar a edicao.
4. Conferir se o arquivo entrou na pasta `ecommerce/produtos` do Cloudinary.
5. Conferir se o campo `imagem` no banco foi atualizado para uma URL `https://res.cloudinary.com/...`.

Depois que todos os produtos antigos forem reupados, o banco deve conter apenas URLs publicas do Cloudinary para imagens de produtos.
