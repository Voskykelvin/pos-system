const { Sequelize, DataTypes } = require('sequelize');

const useMemoryDatabase = !process.env.DATABASE_URL;

function createSequelize() {
  if (useMemoryDatabase) {
    try {
      return new Sequelize({
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false
      });
    } catch {
    const { newDb, DataType } = require('pg-mem');
    const db = newDb({ autoCreateForeignKeyIndices: false });

    db.public.interceptQueries((sql) => {
      if (sql.includes('CREATE INDEX') || sql.includes('CREATE UNIQUE INDEX')) {
        try {
          db.public.none(sql);
        } catch { /* ignore duplicate index in pg-mem */ }
        return [];
      }
      return null;
    });

    try {
      db.public.none('ALTER TABLE information_schema.columns ADD COLUMN IF NOT EXISTS udt_name text;');
    } catch { /* ignore */ }

    db.public.registerOperator({
      operator: '||',
      left: DataType.text,
      right: DataType.integer,
      returns: DataType.text,
      implementation: (a, b) => (a || '') + (b !== null && b !== undefined ? b : '')
    });
    db.public.registerOperator({
      operator: '||',
      left: DataType.integer,
      right: DataType.text,
      returns: DataType.text,
      implementation: (a, b) => (a !== null && a !== undefined ? a : '') + (b || '')
    });

      const dialectModule = db.adapters.createPg();
      return new Sequelize('postgres://pos:pos@localhost:5432/pos_demo', {
        dialect: 'postgres',
        dialectModule,
        logging: false
      });
    }
  }

  return new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true'
        ? { require: true, rejectUnauthorized: false }
        : false
    },
    pool: {
      max: Number(process.env.DB_POOL_MAX || 10),
      min: Number(process.env.DB_POOL_MIN || 2),
      acquire: Number(process.env.DB_POOL_ACQUIRE || 30000),
      idle: Number(process.env.DB_POOL_IDLE || 10000)
    }
  });
}

const sequelize = createSequelize();

if (useMemoryDatabase) {
  const queryInterface = sequelize.getQueryInterface();
  queryInterface.describeTable = async function(tableName) {
    const table = sequelize.modelManager.models.find(m => m.tableName === tableName);
    if (!table) return {};
    const desc = {};
    Object.keys(table.rawAttributes).forEach(key => {
      const attr = table.rawAttributes[key];
      desc[key] = {
        type: attr.type?.key || 'VARCHAR',
        allowNull: attr.allowNull !== false,
        primaryKey: !!attr.primaryKey,
        defaultValue: attr.defaultValue
      };
    });
    return desc;
  };
}
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
  Branch: require('./Branch')(sequelize, modelDataTypes),
  Shift: require('./Shift')(sequelize, modelDataTypes),
  LoyaltyTransaction: require('./LoyaltyTransaction')(sequelize, modelDataTypes),
  Promotion: require('./Promotion')(sequelize, modelDataTypes),
  Supplier: require('./Supplier')(sequelize, modelDataTypes),
  PurchaseOrder: require('./PurchaseOrder')(sequelize, modelDataTypes),
  PurchaseOrderItem: require('./PurchaseOrderItem')(sequelize, modelDataTypes),
  Tenant: require('./Tenant')(sequelize, modelDataTypes),
  CustomerLedger: require('./CustomerLedger')(sequelize, modelDataTypes),
  Expense: require('./Expense')(sequelize, modelDataTypes),
  SubscriptionPayment: require('./SubscriptionPayment')(sequelize, modelDataTypes)
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
