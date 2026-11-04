# Especificação: Document Management System

## 1. Objetivo

Permitir que usuários enviem, listem e baixem seus documentos, mantendo os arquivos no filesystem local e os metadados em memória.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem dos documentos associados ao usuário informado.
- Download de documento pertencente ao usuário informado.
- Identificação simples do usuário pelo cabeçalho `X-User-Id`.

### Fora do escopo

- Autenticação robusta, autorização baseada em papéis ou compartilhamento.
- Armazenamento em nuvem ou serviços externos.
- Versionamento e exclusão de documentos.
- Persistência de metadados após reinício do backend.
- Busca, filtros e paginação.

## 3. Requisitos funcionais

| ID | Requisito |
|---|---|
| RF-01 | O usuário pode enviar um arquivo usando o campo multipart `file`. |
| RF-02 | O sistema associa o arquivo ao usuário identificado por `X-User-Id`. |
| RF-03 | O sistema gera identificador e nome de armazenamento únicos, sem usar o nome informado para compor o caminho local. |
| RF-04 | O usuário pode listar somente os documentos associados ao seu identificador. |
| RF-05 | O usuário pode baixar um documento pelo identificador se ele pertencer ao usuário. |
| RF-06 | O sistema valida campos obrigatórios e limite de tamanho e retorna erros HTTP apropriados. |
| RF-07 | Se o registro em memória falhar após a gravação, o arquivo recém-gravado é removido. |

## 4. Requisitos não funcionais

| ID | Requisito |
|---|---|
| RNF-01 | Arquivos são gravados em `backend/storage` via `multer` com `diskStorage`. |
| RNF-02 | Metadados são mantidos em memória; reiniciar o processo perde os registros. |
| RNF-03 | `PORT` configura a porta HTTP; o padrão é `3000`. |
| RNF-04 | `MAX_FILE_SIZE_BYTES` configura o tamanho máximo; o padrão é 10 MiB. |
| RNF-05 | A API não expõe o nome interno nem o caminho físico do arquivo. |
| RNF-06 | `X-User-Id` oferece isolamento funcional, não autenticação segura para produção. |
| RNF-07 | Erros internos não devem expor stack traces nem caminhos locais ao cliente. |

## 5. Modelo de dados

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | UUID gerado pelo servidor. |
| `originalName` | string | Nome original tratado como dado, nunca como caminho. |
| `storageName` | string | Nome UUID interno usado no filesystem; não é público. |
| `size` | number | Tamanho em bytes. |
| `uploadedAt` | string | Data/hora UTC em ISO 8601. |
| `owner` | string | Identificador recebido em `X-User-Id`. |
| `mimeType` | string | Tipo de mídia informado no upload, com fallback para `application/octet-stream`. |

Respostas públicas incluem todos os campos, exceto `storageName`.

## 6. Contratos de API

As rotas são expostas pelo backend sem prefixo. No desenvolvimento, o frontend usa `/api` e o proxy do Vite remove esse prefixo. Todas as rotas de documentos exigem `X-User-Id` não vazio.

### `POST /upload`

- Entrada: `multipart/form-data`, campo `file`, um arquivo por requisição.
- Sucesso: `201 Created`, corpo JSON com os metadados públicos do documento.
- Erros: `400` para usuário ou arquivo ausente/entrada inválida; `413` para arquivo acima do limite; `500` para falha inesperada.

### `GET /documents`

- Sucesso: `200 OK`, corpo `{ "documents": [...] }` com documentos do usuário ordenados de forma decrescente por `uploadedAt`.
- Lista vazia: `200 OK` com array vazio.
- Erro: `400` se `X-User-Id` estiver ausente ou vazio.

### `GET /documents/:id/download`

- Sucesso: `200 OK`, bytes do arquivo, `Content-Type` do documento e `Content-Disposition: attachment` com o nome original tratado com segurança.
- Erro: `404 Not Found` se o documento não existir ou pertencer a outro usuário.

Formato dos erros JSON: `{ "error": { "code": "CODIGO_ESTAVEL", "message": "Descrição em português" } }`.

## 7. Decisões arquiteturais

- Backend CommonJS com dependências direcionadas `routes -> controllers -> services -> repositories`.
- Rotas encaminham requisições; controllers validam entrada HTTP e montam respostas; services aplicam regras de negócio; repositories encapsulam filesystem e metadados.
- `multer` com `diskStorage` grava exclusivamente em armazenamento local.
- Metadados vivem em memória. Arquivos podem permanecer no disco sem registro após reinício.
- Frontend React é organizado em `pages/`, `components/` e `services/`, e chama o backend por `fetch` no prefixo `/api`.
- A identificação por cabeçalho não substitui autenticação real.

## 8. Plano de execução

1. Implementar rotas, controllers, services e repositories para upload local e metadados em memória; cobrir validação e limites com testes backend.
2. Implementar listagem isolada por usuário e download autorizado; testar respostas e conteúdo binário.
3. Implementar os fluxos React de identificação simples de usuário, upload, listagem e download usando o serviço `fetch`.
4. Validar integração pelo proxy do Vite; executar `npm test` no backend e `npm run build` no frontend.