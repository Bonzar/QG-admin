const mongoose = require("mongoose");
const moment = require("moment/moment");

const Schema = mongoose.Schema;

const AuthorSchema = new Schema({
  first_name: { type: String, required: true, max: 100 },
  family_name: { type: String, required: true, max: 100 },
  date_of_birth: { type: Date },
  date_of_death: { type: Date },
});

// Виртуальное свойство для полного имени автора
AuthorSchema.virtual("name").get(function() {
  return this.family_name + ", " + this.first_name;
});

// Виртуальное свойство - URL автора
AuthorSchema.virtual("url").get(function() {
  return "/catalog/author/" + this._id;
});

// Виртуальное свойство - форматированной даты жизни и сметри автора
AuthorSchema.virtual("date_of_birth_formatted").get(function() {
  return this.date_of_birth
    ? moment(this.date_of_birth).format("MMMM Do, YYYY")
    : "";
});

AuthorSchema.virtual("date_of_death_formatted").get( function() {
  return this.date_of_death
    ? moment(this.date_of_death).format("MMMM Do, YYYY")
    : "";
});

// Виртуальное свойство - форматированной даты жизни и сметри автора ДЛЯ АВТОЗАПОЛНЕНИЯ
AuthorSchema.virtual("date_of_birth_formatted_forauto").get(function() {
  return this.date_of_birth
    ? moment(this.date_of_birth).format("YYYY-MM-DD")
    : "";
});

AuthorSchema.virtual("date_of_death_formatted_forauto").get( function() {
  return this.date_of_death
    ? moment(this.date_of_death).format("YYYY-MM-DD")
    : "";
});

// Export model
module.exports = mongoose.model("Author", AuthorSchema);
