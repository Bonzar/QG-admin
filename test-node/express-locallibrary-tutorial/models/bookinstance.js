var mongoose = require("mongoose");
var moment = require("moment");

var Schema = mongoose.Schema;

var BookInstanceSchema = new Schema({
  book: { type: Schema.ObjectId, ref: "Book", required: true }, //ссылка на книгу
  imprint: { type: String, required: true },
  status: {
    type: String,
    required: true,
    enum: ["Available", "Maintenance", "Loaned", "Reserved"],
    default: "Maintenance",
  },
  due_back: { type: Date, default: Date.now },
});

// Virtual for bookinstance's URL
BookInstanceSchema.virtual("url").get(function () {
  return "/catalog/bookinstance/" + this._id;
});

// Виртуальное поле даты возврата в форматированном виде
BookInstanceSchema.virtual("due_back_formatted").get(() => {
  return moment(this.due_back).format("MMMM Do, YYYY");
});

// Виртуальное поле даты возврата в форматированном виде ДЛЯ АВТОЗАПОЛНЕНИЯ
BookInstanceSchema.virtual("due_back_formatted_forauto").get(() => {
  return moment(this.due_back).format("YYYY-MM-DD");
});

//Export model
module.exports = mongoose.model("BookInstance", BookInstanceSchema);
