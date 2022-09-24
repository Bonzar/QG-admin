var mongoose = require("mongoose");

var Schema = mongoose.Schema;

var GenreInstanseSchema = new Schema({
  name: { type: String, required: true },
});

// Virtual for genre's URL
GenreInstanseSchema.virtual("url").get(function () {
  return "/catalog/genre/" + this._id;
});

// Export model
module.exports = mongoose.model("Genre", GenreInstanseSchema);
