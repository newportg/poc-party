# Reusable Party components

`party-components.js` provides framework-free Web Components for applications that need Party selection and creation:

```html
<script src="./party.js"></script>
<script src="./components/party-components.js"></script>
<poc-party-catalogue id="catalogue"></poc-party-catalogue>
<poc-party-editor id="editor"></poc-party-editor>
<script>
  catalogue.parties = PartyModel.getSampleParties();
  catalogue.addEventListener("party-selected", event => {
    editor.party = event.detail.party;
  });
  editor.addEventListener("party-saved", event => {
    catalogue.parties = [...catalogue.parties, event.detail.party];
  });
</script>
```

## Components

- `<poc-party-catalogue>` exposes `parties` and `selectedId`, and dispatches `party-selected` with `{ detail: { party } }`.
- `<poc-party-editor>` exposes `party` and `parties`, and dispatches `party-saved` or `party-cancelled`.

The editor supports Individual, Company, and Group record types plus the Party Explorer’s core identity/status fields. Components use Shadow DOM and have no framework or build dependency.
