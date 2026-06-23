---
description: Show or update the HTTP test file for a resource
argument-hint: "<resource-name>  e.g. 'orders'"
---

Work with `test/api.http` (VS Code REST Client format).

If `$ARGUMENTS` is empty: show the current contents of `test/api.http`.

If `$ARGUMENTS` is a resource name (e.g. `orders`):
- Read the existing `test/api.http`
- Append a section with all CRUD requests for that resource
- Use `http://localhost:3000/v1/$ARGUMENTS` as base URL
- Include `Authorization: Bearer mock-token` on every request
- Cover: GET all, GET by id, POST (with example body), PUT by id (with example body), DELETE by id
- Separate requests with `###` comments

Always preserve existing entries in the file.
