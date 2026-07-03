const { Sequelize, DataTypes } = require('sequelize');

const useMemoryDatabase = !process.env.DATABASE_URL;

function createSequelize() {
  if (useMemoryDatabase) {
    try {
      require('moment').suppressDeprecationWarnings = true;
    } catch {
      // pg-mem pulls in moment; ignore if its internals change later.
    }

    const { newDb } = require('pg-mem');
    const db = newDb({ autoCreateForeignKeyIndices: true });

    const dialectModule = db.adapters.createPg();
    return new Sequelize('postgres://pos:pos@localhost:5432/pos_demo', {
      dialect: 'postgres',
      dialectModule,
      logging: false
    });
  }

  return new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true'
        ? { require: true, rejectUnauthorized: false }
        : false
    }
  });
}

const sequelize = createSequelize();
const modelDataTypes = useMemoryDatabase
  ? new Proxy(DataTypes, {
    get(target, property) {
      if (property === 'ENUM') {
        return () => target.STRING;
      }
      if (property === 'DECIMAL') {
        return () => target.FLOAT;
      }
      return target[property];
    }
  })
  : DataTypes;

const models = {
  Category: require('./Category')(sequelize, modelDataTypes),
  Product: require('./Product')(sequelize, modelDataTypes),
  InventoryTransaction: require('./InventoryTransaction')(sequelize, modelDataTypes),
  User: require('./User')(sequelize, modelDataTypes),
  Customer: require('./Customer')(sequelize, modelDataTypes),
  Order: require('./Order')(sequelize, modelDataTypes),
  OrderItem: require('./OrderItem')(sequelize, modelDataTypes),
  Payment: require('./Payment')(sequelize, modelDataTypes),
  EtimsInvoice: require('./EtimsInvoice')(sequelize, modelDataTypes),
  AuditLog: require('./AuditLog')(sequelize, modelDataTypes),
  Shift: require('./Shift')(sequelize, modelDataTypes),
  LoyaltyTransaction: require('./LoyaltyTransaction')(sequelize, modelDataTypes),
  Promotion: require('./Promotion')(sequelize, modelDataTypes),
  Supplier: require('./Supplier')(sequelize, modelDataTypes),
  PurchaseOrder: require('./PurchaseOrder')(sequelize, modelDataTypes),
  PurchaseOrderItem: require('./PurchaseOrderItem')(sequelize, modelDataTypes)
};

Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  isUsingMemoryDatabase: () => useMemoryDatabase,
  ...models
};
