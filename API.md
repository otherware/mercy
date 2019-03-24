# Mercy

## Table of Contents

- [Mercy](#mercy)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
    - [Basic usage](#basic-usage)
      - [Flow Options](#flow-options)
      - [Pre-built](#pre-built)
    - [Future plans](#future-plans)

## Overview

Flow control library focused on readability, convenience & analytics.

### Basic usage

```javascript
const Mercy = require('mercy');

```

#### Flow Options

- Mercy.flow().final()
- Mercy.flow().wait()
- Mercy.flow().timeout()
- Mercy.flow().optional()
- Mercy.flow().required()
- Mercy.flow().retry()

- Mercy.execute()

#### Pre-built

- Mercy.input(schema)
- Mercy.validate()
- Mercy.compose()
- Mercy.start()
- Mercy.prepare()
- Mercy.stop()
- Mercy.restart()
- Mercy.echo()
- Mercy.wait()
- Mercy.mock(flag)
- Mercy.transform()
- Mercy.defaults()
- Mercy.inject()
  - Mercy.inject().defaults()
- Mercy.wreck()
  - Mercy.wreck().defaults()

### Future plans

- `race`: returns the first flow to complete successfully
- `alternatives`: Try first, if it doesn't work then try next
- `switch`: based on specified value then execute single function
  - Needed for supporting different verticals
  - Allows for simplified output formats
